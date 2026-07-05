package main

import (
	"context"
	"testing"

	"github.com/google/uuid"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
)

// TestCompileEventToProtoStarted confirms a domain.Event with the compile-
// started type round-trips into the wire-shape CompileEvent_CompileStarted
// wrapper. Empty payload, just the marker.
func TestCompileEventToProtoStarted(t *testing.T) {
	got := compileEventToProto(domain.Event{ID: uuid.New().String(), Type: engine.EventCompileStarted})
	if got == nil {
		t.Fatal("compileEventToProto returned nil for compile-started")
	}
	if _, ok := got.Event.(*provarv1.CompileEvent_CompileStarted); !ok {
		t.Errorf("event type = %T, want *CompileEvent_CompileStarted", got.Event)
	}
}

// TestCompileEventToProtoActionStarted confirms ActionStartedData flows
// through the oneof wrapper with every field populated.
func TestCompileEventToProtoActionStarted(t *testing.T) {
	got := compileEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventActionStarted,
		Data: engine.ActionStartedData{ActionID: "open_login", Name: "Open Login"},
	})
	if got == nil {
		t.Fatal("compileEventToProto returned nil for action-started")
	}
	wrapper, ok := got.Event.(*provarv1.CompileEvent_ActionStarted)
	if !ok {
		t.Fatalf("event type = %T, want *CompileEvent_ActionStarted", got.Event)
	}
	if wrapper.ActionStarted.GetActionId() != "open_login" {
		t.Errorf("action_id = %q, want %q", wrapper.ActionStarted.GetActionId(), "open_login")
	}
	if wrapper.ActionStarted.GetName() != "Open Login" {
		t.Errorf("name = %q, want %q", wrapper.ActionStarted.GetName(), "Open Login")
	}
}

// TestCompileEventToProtoActionFinished confirms ActionFinishedData carries
// the per-action Lua body into the wire response.
func TestCompileEventToProtoActionFinished(t *testing.T) {
	got := compileEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventActionFinished,
		Data: engine.ActionFinishedData{ActionID: "fill", Body: `page:locator("#x"):fill("y")`},
	})
	if got == nil {
		t.Fatal("compileEventToProto returned nil for action-finished")
	}
	wrapper, ok := got.Event.(*provarv1.CompileEvent_ActionFinished)
	if !ok {
		t.Fatalf("event type = %T, want *CompileEvent_ActionFinished", got.Event)
	}
	if wrapper.ActionFinished.GetBody() == "" {
		t.Error("action-finished body is empty")
	}
}

// TestCompileEventToProtoActionFailed confirms ActionFailedData carries
// the error string. Compile aborts on first failure; the failed action
// is reported so the client can pinpoint the broken step.
func TestCompileEventToProtoActionFailed(t *testing.T) {
	got := compileEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventActionFailed,
		Data: engine.ActionFailedData{ActionID: "click_submit", Error: "selector not found"},
	})
	if got == nil {
		t.Fatal("compileEventToProto returned nil for action-failed")
	}
	wrapper, ok := got.Event.(*provarv1.CompileEvent_ActionFailed)
	if !ok {
		t.Fatalf("event type = %T, want *CompileEvent_ActionFailed", got.Event)
	}
	if wrapper.ActionFailed.GetError() == "" {
		t.Error("action-failed error is empty")
	}
}

// TestCompileEventToProtoFinishedSuccess: terminal event with COMPLETED
// status and a populated LuaCode. Error field stays empty on success.
func TestCompileEventToProtoFinishedSuccess(t *testing.T) {
	got := compileEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventCompileFinished,
		Data: engine.CompileFinishedData{
			Status:   string(domain.JobCompleted),
			LuaCode:  "local steps = {}\nreturn steps\n",
			Duration: "1.2s",
		},
	})
	if got == nil {
		t.Fatal("compileEventToProto returned nil for compile-finished")
	}
	wrapper, ok := got.Event.(*provarv1.CompileEvent_CompileFinished)
	if !ok {
		t.Fatalf("event type = %T, want *CompileEvent_CompileFinished", got.Event)
	}
	if got := wrapper.CompileFinished.GetStatus(); got != provarv1.JobStatus_JOB_STATUS_COMPLETED {
		t.Errorf("status = %v, want JOB_STATUS_COMPLETED", got)
	}
	if wrapper.CompileFinished.GetLuaCode() == "" {
		t.Error("lua_code is empty")
	}
	if wrapper.CompileFinished.GetError() != "" {
		t.Errorf("error = %q, want empty on success", wrapper.CompileFinished.GetError())
	}
}

// TestCompileEventToProtoFinishedFailure: terminal event with FAILED
// status and a populated error. LuaCode stays empty on failure.
func TestCompileEventToProtoFinishedFailure(t *testing.T) {
	got := compileEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventCompileFinished,
		Data: engine.CompileFinishedData{
			Status: string(domain.JobFailed),
			Error:  "compile click_submit: selector not found",
		},
	})
	if got == nil {
		t.Fatal("compileEventToProto returned nil for compile-finished")
	}
	wrapper := got.Event.(*provarv1.CompileEvent_CompileFinished)
	if got := wrapper.CompileFinished.GetStatus(); got != provarv1.JobStatus_JOB_STATUS_FAILED {
		t.Errorf("status = %v, want JOB_STATUS_FAILED", got)
	}
	if wrapper.CompileFinished.GetError() == "" {
		t.Error("error is empty on failure")
	}
	if wrapper.CompileFinished.GetLuaCode() != "" {
		t.Error("lua_code populated on failure")
	}
}

// TestCompileEventToProtoUnknownReturnsNil guards the switch default —
// unknown engine event types are silently dropped so future additions to
// libs/engine don't force a recompile of the API.
func TestCompileEventToProtoUnknownReturnsNil(t *testing.T) {
	got := compileEventToProto(domain.Event{ID: uuid.New().String(), Type: "unknown-future-type"})
	if got != nil {
		t.Errorf("compileEventToProto returned %v for unknown type, want nil", got)
	}
}

// TestJobStatusToProto covers the four statuses the wire enum mirrors and
// the UNSPECIFIED fallthrough for unknown values (e.g. JobIdle).
func TestJobStatusToProto(t *testing.T) {
	cases := []struct {
		in   domain.JobStatus
		want provarv1.JobStatus
	}{
		{domain.JobRunning, provarv1.JobStatus_JOB_STATUS_RUNNING},
		{domain.JobCompleted, provarv1.JobStatus_JOB_STATUS_COMPLETED},
		{domain.JobFailed, provarv1.JobStatus_JOB_STATUS_FAILED},
		{domain.JobStopped, provarv1.JobStatus_JOB_STATUS_STOPPED},
		{domain.JobIdle, provarv1.JobStatus_JOB_STATUS_UNSPECIFIED},
		{domain.JobPaused, provarv1.JobStatus_JOB_STATUS_UNSPECIFIED},
	}
	for _, c := range cases {
		if got := jobStatusToProto(c.in); got != c.want {
			t.Errorf("jobStatusToProto(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}

// TestCompileRequiresProjectPathViaServer exercises the same validation
// through the registered server. Keeps the test close to the wire path so
// a future signature change can't accidentally drop the check.
func TestCompileRequiresProjectPathViaServer(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewCompileServiceClient(conn)
	stream, err := client.Compile(context.Background(), &provarv1.CompileRequest{FilePath: ".provar/tests/login.test.yml"})
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	if _, err := stream.Recv(); err == nil {
		t.Error("Compile with empty project_path returned no error; want InvalidArgument")
	} else if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

// TestCompileRequiresFilePathViaServer mirrors the file_path check.
func TestCompileRequiresFilePathViaServer(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewCompileServiceClient(conn)
	dir := initSampleProject(t)
	stream, err := client.Compile(context.Background(), &provarv1.CompileRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	if _, err := stream.Recv(); err == nil {
		t.Error("Compile with empty file_path returned no error; want InvalidArgument")
	} else if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}
