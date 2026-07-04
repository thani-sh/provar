package engine

import (
	"context"
	"strings"
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

// TestSystemPromptTeachesTheLoop guards the system prompt against losing the key
// instructions we give the LLM. The process loop, the no-repeat rule, and the
// no-empty-args rule are what keep the compiled Lua from looking like the bad
// output we saw (13 identical navigates, empty selectors).
func TestSystemPromptTeachesTheLoop(t *testing.T) {
	p := systemPrompt()
	mustContain := []string{
		"PROCESS",
		"get_page_source",
		"Do NOT repeat",
		"empty or whitespace-only",
		"{{var}}",
		"call done",
	}
	for _, want := range mustContain {
		if !strings.Contains(p, want) {
			t.Errorf("systemPrompt() missing %q", want)
		}
	}
}

// TestBuildActionPromptPlaceholderOnly guards against the LLM seeing both the
// placeholder form and the resolved value for the same variable — that ambiguity
// is what caused the model to emit BOTH `{{baseUrl}}` and the literal URL in the
// same action in the previous output.
func TestBuildActionPromptPlaceholderOnly(t *testing.T) {
	action := domain.Action{
		ID:   "open_login_page",
		Name: "Open Login Page",
		Info: "Navigate to the demo login page",
	}
	vars := map[string]string{
		"baseUrl": "https://demo.thani.sh/",
	}
	got := buildActionPrompt(action, vars)
	if !strings.Contains(got, "{{baseUrl}}") {
		t.Errorf("expected placeholder {{baseUrl}} in prompt, got:\n%s", got)
	}
	if strings.Contains(got, "https://demo.thani.sh/") {
		t.Errorf("resolved variable value leaked into prompt, got:\n%s", got)
	}
	wantSubstrings := []string{
		action.ID,
		action.Name,
		action.Info,
	}
	for _, want := range wantSubstrings {
		if !strings.Contains(got, want) {
			t.Errorf("buildActionPrompt missing %q in:\n%s", want, got)
		}
	}
}

// TestBuildActionPromptNoVars confirms the prompt still composes cleanly when
// the project has no variables — no broken heading, no trailing dangling line.
func TestBuildActionPromptNoVars(t *testing.T) {
	got := buildActionPrompt(domain.Action{ID: "x", Name: "X", Info: "do x"}, nil)
	if strings.Contains(got, "{{") {
		t.Errorf("expected no placeholders when vars is nil, got:\n%s", got)
	}
}
