package project

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/logger"
)

// runForwarder publishes engine events emitted by Runner.Run to the
// v1/project/run/* wire namespace. Wire types are atomic (full names) —
// the table is the only source of truth. The "action-*" keys also appear
// in compileForwarder pointing at v1/project/compile/*, because the
// engine reuses the same event type name across both code paths.
var runForwarder = &api.Forwarder{
	Events: map[string]string{
		"run-started":                 "v1/project/run/started",
		"run-finished":                "v1/project/run/finished",
		"action-started":              "v1/project/run/action-started",
		"action-finished":             "v1/project/run/action-finished",
		"action-failed":               "v1/project/run/action-failed",
		"visual-comparison-triggered": "v1/project/run/visual-triggered",
	},
}

func init() {
	api.Register("v1/project/run", &projectRunHandler{})
}

// projectRunReq is the data shape for v1/project/run. project is the
// absolute path of a directory containing .provar/ — the project is loaded
// on first use. file is the .test.yml path relative to the project root.
// pathIndex is the ADR's second file selector; v1 treats it as a synonym
// for file (it'll be wired to batch selection when the engine grows that
// capability). headless toggles the browser. upTo stops at the named
// action if set.
type projectRunReq struct {
	Project   string `json:"project"`
	File      string `json:"file"`
	PathIndex string `json:"pathIndex,omitempty"`
	UpTo      string `json:"upTo,omitempty"`
	Headless  bool   `json:"headless,omitempty"`
}

// projectRunReply mirrors projectCompileReply — the immediate ak-paired
// reply carries the jobId that subsequent v1/project/run/* events and
// v1/project/job/* control events reference.
type projectRunReply struct {
	JobID string `json:"jobId"`
}

type projectRunHandler struct {
	api.BaseHandler
}

func (h *projectRunHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectRunReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}

	// file is the primary selector; pathIndex is the ADR's second slot,
	// currently treated as a synonym for file (no batch-run support in v1).
	file := req.File
	if file == "" {
		file = req.PathIndex
	}
	if file == "" {
		return h.WriteError(ctx, c, env, errors.New("file is required"))
	}

	// Runner needs both the .test.yml (for actions) and the compiled .test.lua.
	// The compiled file lives next to the source as <name>.test.lua — same
	// naming convention the CLI compile command writes.
	actions, err := domain.ParseFile(project.Path, file)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	luaPath := strings.TrimSuffix(file, ".test.yml") + ".test.lua"
	luaCode, err := os.ReadFile(luaPath)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}

	job, err := s.Run().Run(ctx, actions, string(luaCode), engine.RunOptions{
		Headless: req.Headless,
		Browser:  project.Browser,
		Vars:     project.Vars,
		UpTo:     req.UpTo,
	})
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}

	jobID := s.RegisterJob(job)
	logger.Info("run started", "jobId", jobID, "file", file)

	if err := h.WriteReply(ctx, c, env, projectRunReply{JobID: jobID}); err != nil {
		_ = job.Stop()
		return err
	}

	// Runner owns its own browser session (created inside Runner.Run), so the
	// forwarder cleanup gets nil — nothing to close from here.
	go runForwarder.Forward(ctx, s, c, job, nil)
	return nil
}
