package handlers

import (
	"context"
	"encoding/json"
	"os"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/run", handleProjectRun)
}

// projectRunReq is the data shape for v1/project/run. project is the
// absolute path of a directory containing .provar/ — the project is loaded
// on first use. file is the .test.yml path relative to the project root.
// headless toggles the browser. upTo stops at the named action if set.
type projectRunReq struct {
	Project string `json:"project"`
	File    string `json:"file"`
	UpTo    string `json:"upTo,omitempty"`
}

// projectRunReply mirrors projectCompileReply — the immediate ak-paired
// reply carries the jobId that subsequent v1/project/run/* events and
// v1/project/job/* control events reference.
type projectRunReply struct {
	JobID string `json:"jobId"`
}

func handleProjectRun(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectRunReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}

	// Runner needs both the .test.yml (for actions) and the compiled .test.lua.
	// The compiled file lives next to the source as <name>.test.lua — same
	// naming convention the CLI compile command writes.
	actions, err := domain.ParseFile(project.Path, req.File)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "parse file: "+err.Error())
	}
	luaPath := req.File[:len(req.File)-len(".test.yml")] + ".test.lua"
	luaCode, err := os.ReadFile(luaPath)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "read compiled lua: "+err.Error())
	}

	job, err := s.Run().Run(ctx, actions, string(luaCode), engine.RunOptions{
		Headless: true,
		Browser:  project.Browser,
		Vars:     project.Vars,
		UpTo:     req.UpTo,
	})
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "run: "+err.Error())
	}

	jobID := s.RegisterJob(job)
	logger.Info("run started", "jobId", jobID, "file", req.File)

	if err := api.WriteEnvelope(ctx, c, env.Type, projectRunReply{JobID: jobID}, env.Meta.ID); err != nil {
		_ = job.Stop()
		return err
	}

	// Runner owns its own browser session (created inside Runner.Run), so the
	// forwardJob cleanup gets nil — nothing to close from here.
	go forwardJob(ctx, s, c, job, nil, "project/run")
	return nil
}
