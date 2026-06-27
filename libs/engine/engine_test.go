package engine

import (
	"context"
	"testing"

	"github.com/thani-sh/provar/libs/domain"
)

func TestInterpolateVars(t *testing.T) {
	code := "page:goto(\"{{BASE_URL}}/login\")\nemail = \"{{USER_EMAIL}}\""
	vars := map[string]string{
		"BASE_URL":   "https://example.com",
		"USER_EMAIL": "test@provar.com",
	}
	expected := "page:goto(\"https://example.com/login\")\nemail = \"test@provar.com\""
	result := interpolateVars(code, vars)
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestRunWaitLoop(t *testing.T) {
	job := domain.NewJob("test-job", domain.JobStopped)
	if runWaitLoop(context.Background(), job) {
		t.Error("expected runWaitLoop to return false for Stopped job")
	}
	job = domain.NewJob("test-job", domain.JobRunning)
	if !runWaitLoop(context.Background(), job) {
		t.Error("expected runWaitLoop to return true for Running job")
	}
	job = domain.NewJob("test-job", domain.JobPaused)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if runWaitLoop(ctx, job) {
		t.Error("expected runWaitLoop to return false when context is cancelled while paused")
	}
}
