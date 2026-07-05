package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
)

func TestRunEventToProtoStarted(t *testing.T) {
	re, h := runEventToProto(domain.Event{ID: uuid.New().String(), Type: engine.EventRunStarted}, "", "stem")
	if re == nil {
		t.Fatal("runEventToProto returned nil for run-started")
	}
	if _, ok := re.Event.(*provarv1.RunEvent_RunStarted); !ok {
		t.Errorf("event type = %T, want *RunEvent_RunStarted", re.Event)
	}
	if h != visualSkip {
		t.Errorf("handleVisual = %v, want visualSkip", h)
	}
}

func TestRunEventToProtoTaskStarted(t *testing.T) {
	re, _ := runEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventTaskStarted,
		Data: map[string]string{"taskId": "click_login", "title": "Click Login"},
	}, "", "stem")
	wrapper, ok := re.Event.(*provarv1.RunEvent_TaskStarted)
	if !ok {
		t.Fatalf("event type = %T, want *RunEvent_TaskStarted", re.Event)
	}
	if wrapper.TaskStarted.GetTaskId() != "click_login" {
		t.Errorf("task_id = %q, want %q", wrapper.TaskStarted.GetTaskId(), "click_login")
	}
	if wrapper.TaskStarted.GetTitle() != "Click Login" {
		t.Errorf("title = %q, want %q", wrapper.TaskStarted.GetTitle(), "Click Login")
	}
}

func TestRunEventToProtoTaskFailed(t *testing.T) {
	re, _ := runEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventTaskFailed,
		Data: map[string]string{"taskId": "submit", "error": "selector not found"},
	}, "", "stem")
	wrapper := re.Event.(*provarv1.RunEvent_TaskFailed)
	if wrapper.TaskFailed.GetError() == "" {
		t.Error("error is empty")
	}
}

func TestRunEventToProtoRunFinished(t *testing.T) {
	re, _ := runEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventRunFinished,
		Data: map[string]any{"status": string(domain.JobCompleted), "duration": "2.5s"},
	}, "", "stem")
	wrapper := re.Event.(*provarv1.RunEvent_RunFinished)
	if got := wrapper.RunFinished.GetStatus(); got != provarv1.JobStatus_JOB_STATUS_COMPLETED {
		t.Errorf("status = %v, want JOB_STATUS_COMPLETED", got)
	}
	if wrapper.RunFinished.GetDuration() != "2.5s" {
		t.Errorf("duration = %q, want %q", wrapper.RunFinished.GetDuration(), "2.5s")
	}
}

func TestRunEventToProtoVisualIsHandled(t *testing.T) {
	re, h := runEventToProto(domain.Event{
		ID:   uuid.New().String(),
		Type: engine.EventVisualCompareTriggered,
		Data: map[string]any{"taskId": "after_login", "screenshotBase64": "AAAA"},
	}, "/tmp", "stem")
	if _, ok := re.Event.(*provarv1.RunEvent_VisualComparisonTriggered); !ok {
		t.Errorf("event type = %T, want *RunEvent_VisualComparisonTriggered", re.Event)
	}
	if h != visualHandled {
		t.Errorf("handleVisual = %v, want visualHandled", h)
	}
}

func TestRunRequiresProjectPathViaServer(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewRunServiceClient(conn)
	stream, err := client.Run(context.Background(), &provarv1.RunRequest{FilePath: ".provar/tests/login.test.yml"})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if _, err := stream.Recv(); err == nil {
		t.Error("Run with empty project_path returned no error; want InvalidArgument")
	} else if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestRunRequiresFilePathViaServer(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewRunServiceClient(conn)
	dir := initSampleProject(t)
	stream, err := client.Run(context.Background(), &provarv1.RunRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if _, err := stream.Recv(); err == nil {
		t.Error("Run with empty file_path returned no error; want InvalidArgument")
	} else if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestRunMissingLuaReturnsFailedPrecondition(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewRunServiceClient(conn)
	stream, err := client.Run(context.Background(), &provarv1.RunRequest{
		ProjectPath: dir,
		FilePath:    ".provar/tests/login.test.yml",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if _, err := stream.Recv(); err == nil {
		t.Error("Run without compiled .test.lua returned no error; want FailedPrecondition")
	} else if got, want := statusCode(err), "FailedPrecondition"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestAcceptBaselineRequiresProjectPathViaServer(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewRunServiceClient(conn)
	_, err := client.AcceptBaseline(context.Background(), &provarv1.AcceptBaselineRequest{})
	if err == nil {
		t.Error("AcceptBaseline with empty project_path succeeded; want InvalidArgument")
	} else if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestAcceptBaselineMissingScreenshotsReturnsNotFound(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewRunServiceClient(conn)
	_, err := client.AcceptBaseline(context.Background(), &provarv1.AcceptBaselineRequest{ProjectPath: dir})
	if err == nil {
		t.Error("AcceptBaseline with no screenshots succeeded; want NotFound")
	} else if got, want := statusCode(err), "NotFound"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestAcceptBaselinePromotesPNGs(t *testing.T) {
	dir := initSampleProject(t)
	visualDir := filepath.Join(dir, apiVisualDir, "login")
	if err := os.MkdirAll(visualDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	pngPath := filepath.Join(visualDir, "click_login.png")
	if err := os.WriteFile(pngPath, []byte("fake-png"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewRunServiceClient(conn)
	resp, err := client.AcceptBaseline(context.Background(), &provarv1.AcceptBaselineRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("AcceptBaseline: %v", err)
	}
	if resp.GetAccepted() != 1 {
		t.Errorf("accepted = %d, want 1", resp.GetAccepted())
	}
	baselinePath := filepath.Join(dir, apiBaselinesDir, "login", "click_login.png")
	if _, err := os.Stat(baselinePath); err != nil {
		t.Errorf("baseline not created at %s: %v", baselinePath, err)
	}
}

// TestVisualCompareResult covers the three meaningful states: first run
// (no baseline), match (identical bytes), and diff (different bytes).
// UNSPECIFIED is reserved for malformed base64, which we don't simulate
// here because real screenshots always decode.
func TestVisualCompareResult(t *testing.T) {
	tmp := t.TempDir()
	png := []byte("hello")
	b64 := base64.StdEncoding.EncodeToString(png)
	baseline := filepath.Join(tmp, "baseline.png")
	if err := os.WriteFile(baseline, png, 0o644); err != nil {
		t.Fatalf("write baseline: %v", err)
	}
	cases := []struct {
		name     string
		pngB64   string
		baseline string
		want     provarv1.VisualComparisonResult
	}{
		{"first run, no baseline", b64, filepath.Join(tmp, "missing.png"), provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_FIRST_RUN},
		{"match", b64, baseline, provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_MATCH},
		{"diff", base64.StdEncoding.EncodeToString([]byte("different")), baseline, provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_DIFF},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := visualCompareResult(c.pngB64, c.baseline); got != c.want {
				t.Errorf("visualCompareResult = %v, want %v", got, c.want)
			}
		})
	}
}

func TestSaveVisualScreenshotWritesPNGs(t *testing.T) {
	projectRoot := t.TempDir()
	png := []byte("screenshot-bytes")
	ev := domain.Event{
		ID: uuid.New().String(),
		Data: map[string]any{
			"taskId":           "step_x",
			"screenshotBase64": base64.StdEncoding.EncodeToString(png),
		},
	}
	if err := saveVisualScreenshot(projectRoot, "login", ev); err != nil {
		t.Fatalf("saveVisualScreenshot: %v", err)
	}
	got, err := os.ReadFile(projectVisualPath(projectRoot, "login", "step_x"))
	if err != nil {
		t.Fatalf("read saved: %v", err)
	}
	if string(got) != string(png) {
		t.Errorf("saved bytes = %q, want %q", got, png)
	}
}

func TestFormatVisualShortHash(t *testing.T) {
	png := []byte("hello")
	sum := sha256.Sum256(png)
	want := hex.EncodeToString(sum[:])[:12]
	if got := formatVisualShortHash(png); got != want {
		t.Errorf("formatVisualShortHash = %q, want %q", got, want)
	}
}
