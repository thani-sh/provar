package handlers

import (
	"context"
	"encoding/json"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
)

// compileForwarder publishes engine events emitted by Compiler.Compile to
// the v1/project/compile/* wire namespace. Wire types are atomic (full
// names) — the table is the only source of truth. The "action-*" keys
// also appear in runForwarder pointing at v1/project/run/*, because the
// engine reuses the same event type name across both code paths.
var compileForwarder = &Forwarder{
	Events: map[string]string{
		"compile-started":  "v1/project/compile/started",
		"compile-finished": "v1/project/compile/finished",
		"action-started":   "v1/project/compile/action-started",
		"action-finished":  "v1/project/compile/action-finished",
		"action-failed":    "v1/project/compile/action-failed",
	},
}

func init() {
	api.Register("v1/project/compile", handleProjectCompile)
}

// projectCompileReq is the data shape for v1/project/compile. project is
// the absolute path of a directory containing .provar/; the project is
// loaded on first use (or returned from the cache) — there's no separate
// open action.
type projectCompileReq struct {
	Project  string `json:"project"`
	File     string `json:"file"`
	UpTo     string `json:"upTo,omitempty"`
	Headless bool   `json:"headless,omitempty"`
}

// projectCompileReply is the immediate reply (before the engine emits
// anything). jobId references the registered domain.Job; the client uses
// it in project/job/* control events and to correlate incoming
// v1/project/compile/* events.
type projectCompileReply struct {
	JobID string `json:"jobId"`
}

func handleProjectCompile(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectCompileReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	actions, err := domain.ParseFile(project.Path, req.File)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "parse file: "+err.Error())
	}

	w, h := project.Browser.Resolved()
	browserSession, err := browser.NewSession(ctx, browser.Options{
		Headless: req.Headless,
		Width:    w,
		Height:   h,
	})
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "launch browser: "+err.Error())
	}

	job, err := s.Compile().Compile(ctx, actions, engine.CompileOptions{
		SpecPath: req.File,
		Vars:     project.Vars,
		Browser:  browserSession,
	})
	if err != nil {
		_ = browserSession.Close()
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "compile: "+err.Error())
	}

	jobID := s.RegisterJob(job)
	logger.Info("compile started", "jobId", jobID, "file", req.File)

	// Reply with the jobId so the client can correlate incoming v1/project/compile/* events.
	if err := api.WriteEnvelope(ctx, c, env.Type, projectCompileReply{JobID: jobID}, env.Meta.ID); err != nil {
		_ = job.Stop()
		_ = browserSession.Close()
		return err
	}

	// Forward every engine event for this job to the client, then clean up.
	go compileForwarder.Forward(ctx, s, c, job, browserSession)
	return nil
}
