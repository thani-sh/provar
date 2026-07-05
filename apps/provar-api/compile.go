package main

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
	"github.com/thani-sh/provar/libs/models"
)

// clientFactory builds a fresh models.Client per Compile RPC. Loaded lazily
// because settings can change between calls; held by the server struct so
// tests can swap in a mock without touching real provider SDKs.
type clientFactory func() (models.Client, error)

// compileServer implements CompileService. Each RPC owns its own browser
// session for the duration of the call (browser launches take ~1–2s, so
// caching across RPCs would need session multiplexing — out of scope for
// v1). The handler subscribes to the engine.Job and forwards each event as
// a CompileEvent on the wire.
type compileServer struct {
	provarv1.UnimplementedCompileServiceServer
	newClient clientFactory
}

// Compile streams per-action progress and the final Lua code for one
// .test.yml file. Errors before compile-started (bad project, missing
// file) surface as gRPC status codes; errors during compilation surface
// as EventActionFailed + EventCompileFinished with status=FAILED.
func (s *compileServer) Compile(req *provarv1.CompileRequest, stream grpc.ServerStreamingServer[provarv1.CompileEvent]) error {
	ctx := stream.Context()
	if req.GetProjectPath() == "" {
		return status.Error(codes.InvalidArgument, "project_path is required")
	}
	if req.GetFilePath() == "" {
		return status.Error(codes.InvalidArgument, "file_path is required")
	}
	project, err := domain.LoadProject(req.GetProjectPath())
	if err != nil {
		return mapLoadError(err)
	}
	actions, err := domain.ParseFile(project.Path, req.GetFilePath())
	if err != nil {
		return status.Error(codes.InvalidArgument, err.Error())
	}
	client, err := s.newClient()
	if err != nil {
		return status.Error(codes.FailedPrecondition, fmt.Sprintf("load settings: %v", err))
	}
	w, h := project.Browser.Resolved()
	browserSession, err := browser.NewSession(ctx, browser.Options{
		Headless: req.GetHeadless(),
		Width:    w,
		Height:   h,
	})
	if err != nil {
		return status.Errorf(codes.Unavailable, "launch browser: %v", err)
	}
	defer func() {
		if cerr := browserSession.Close(); cerr != nil && !errors.Is(cerr, context.Canceled) {
			logger.Warn("close browser", "err", cerr)
		}
	}()
	compiler := engine.NewCompiler(client)
	job, err := compiler.Compile(ctx, actions, engine.CompileOptions{
		SpecPath: req.GetFilePath(),
		Vars:     project.Vars,
		Browser:  browserSession,
	})
	if err != nil {
		return status.Error(codes.InvalidArgument, err.Error())
	}
	return streamCompileEvents(job, stream)
}

// streamCompileEvents pumps engine.Job events into the gRPC stream. The
// loop exits when the job closes its listener channels, which happens
// after the terminal EventCompileFinished.
func streamCompileEvents(job *domain.Job, stream grpc.ServerStreamingServer[provarv1.CompileEvent]) error {
	for ev := range job.Subscribe() {
		ce := compileEventToProto(ev)
		if ce == nil {
			continue
		}
		if err := stream.Send(ce); err != nil {
			return err
		}
	}
	return nil
}

// compileEventToProto translates a domain.Event emitted by engine.Compiler
// into the wire-shape CompileEvent. Returns nil for unknown event types so
// callers can ignore future additions without recompiling the API.
func compileEventToProto(ev domain.Event) *provarv1.CompileEvent {
	switch ev.Type {
	case engine.EventCompileStarted:
		return &provarv1.CompileEvent{Event: &provarv1.CompileEvent_CompileStarted{CompileStarted: &provarv1.CompileStarted{}}}
	case engine.EventActionStarted:
		d, ok := ev.Data.(engine.ActionStartedData)
		if !ok {
			return nil
		}
		return &provarv1.CompileEvent{Event: &provarv1.CompileEvent_ActionStarted{ActionStarted: &provarv1.ActionStarted{
			ActionId: d.ActionID,
			Name:     d.Name,
		}}}
	case engine.EventActionFinished:
		d, ok := ev.Data.(engine.ActionFinishedData)
		if !ok {
			return nil
		}
		return &provarv1.CompileEvent{Event: &provarv1.CompileEvent_ActionFinished{ActionFinished: &provarv1.ActionFinished{
			ActionId: d.ActionID,
			Body:     d.Body,
		}}}
	case engine.EventActionFailed:
		d, ok := ev.Data.(engine.ActionFailedData)
		if !ok {
			return nil
		}
		return &provarv1.CompileEvent{Event: &provarv1.CompileEvent_ActionFailed{ActionFailed: &provarv1.ActionFailed{
			ActionId: d.ActionID,
			Error:    d.Error,
		}}}
	case engine.EventCompileFinished:
		d, ok := ev.Data.(engine.CompileFinishedData)
		if !ok {
			return nil
		}
		return &provarv1.CompileEvent{Event: &provarv1.CompileEvent_CompileFinished{CompileFinished: &provarv1.CompileFinished{
			Status:   jobStatusToProto(domain.JobStatus(d.Status)),
			LuaCode:  d.LuaCode,
			Duration: d.Duration,
			Error:    d.Error,
		}}}
	}
	return nil
}

// jobStatusToProto maps the domain job status into the wire enum. Unknown
// values (e.g. JobIdle from an early-cancelled job) collapse to UNSPECIFIED
// rather than failing the stream — clients should treat UNSPECIFIED as
// "no useful status yet".
func jobStatusToProto(s domain.JobStatus) provarv1.JobStatus {
	switch s {
	case domain.JobRunning:
		return provarv1.JobStatus_JOB_STATUS_RUNNING
	case domain.JobCompleted:
		return provarv1.JobStatus_JOB_STATUS_COMPLETED
	case domain.JobFailed:
		return provarv1.JobStatus_JOB_STATUS_FAILED
	case domain.JobStopped:
		return provarv1.JobStatus_JOB_STATUS_STOPPED
	}
	return provarv1.JobStatus_JOB_STATUS_UNSPECIFIED
}
