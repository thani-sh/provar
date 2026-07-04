package engine

import (
	"context"
	"strings"
	"testing"

	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
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
		"call done",
	}
	for _, want := range mustContain {
		if !strings.Contains(p, want) {
			t.Errorf("systemPrompt() missing %q", want)
		}
	}
}

// TestSystemPromptHasNoPlaceholderConcept locks in the post-reverse-sub
// behaviour: with substitution handled at translate time, the LLM doesn't
// need to know about {{var}} placeholders at all. If this string ever
// re-appears in the system prompt, the LLM will start emitting placeholder
// syntax and the simple "use the value" framing breaks.
func TestSystemPromptHasNoPlaceholderConcept(t *testing.T) {
	p := systemPrompt()
	for _, banned := range []string{"{{var}}", "{{name}}", "{{url}}"} {
		if strings.Contains(p, banned) {
			t.Errorf("systemPrompt() should not mention %q now that reverse-substitution handles portability", banned)
		}
	}
	if !strings.Contains(p, "Available values") {
		t.Errorf("systemPrompt() should reference the 'Available values' section of the action prompt")
	}
}

// TestBuildActionPromptListsValues verifies the new framing: the prompt hands
// the LLM the resolved values explicitly (with their labels) and never shows
// placeholder syntax. The LLM emits values directly; reverseSubstituteActions
// rewrites them to {{name}} form when generating the Lua.
func TestBuildActionPromptListsValues(t *testing.T) {
	action := domain.Action{
		ID:   "open_login_page",
		Name: "Open Login Page",
		Info: "Navigate to the demo login page",
	}
	vars := map[string]string{
		"baseUrl":  "https://demo.thani.sh/",
		"username": "demo",
		"password": "demo123",
	}
	got := buildActionPrompt(action, vars)

	// Both the label and its resolved value must be present.
	wantFragments := []string{
		action.ID,
		action.Name,
		action.Info,
		"Available values",
		"baseUrl = https://demo.thani.sh/",
		"username = demo",
		"password = demo123",
	}
	for _, want := range wantFragments {
		if !strings.Contains(got, want) {
			t.Errorf("buildActionPrompt missing %q in:\n%s", want, got)
		}
	}

	// Placeholder form should NOT appear in the prompt — the LLM should never
	// see {{baseUrl}} in its instructions under the new design.
	for _, banned := range []string{"{{baseUrl}}", "{{username}}", "{{password}}", "{{name}}"} {
		if strings.Contains(got, banned) {
			t.Errorf("buildActionPrompt should not contain placeholder %q, got:\n%s", banned, got)
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

// TestReverseSubstituteExactMatch covers the simplest case: the recorded value
// equals the variable value byte-for-byte and should be replaced with the
// placeholder form.
func TestReverseSubstituteExactMatch(t *testing.T) {
	actions := []browser.Action{
		{Name: "navigate", Args: map[string]any{"url": "https://demo.thani.sh/"}},
	}
	vars := map[string]string{"baseUrl": "https://demo.thani.sh/"}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["url"] != "{{baseUrl}}" {
		t.Errorf("expected %q, got %v", "{{baseUrl}}", got[0].Args["url"])
	}
}

// TestReverseSubstituteURLPrefix exercises the prefix-match path: the recorded
// value starts with the variable's value (which ends with "/") and continues
// with a path. The trailing slash of val becomes part of the placeholder so
// the output preserves the URL structure.
func TestReverseSubstituteURLPrefix(t *testing.T) {
	actions := []browser.Action{
		{Name: "navigate", Args: map[string]any{"url": "https://demo.thani.sh/login"}},
	}
	vars := map[string]string{"baseUrl": "https://demo.thani.sh/"}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["url"] != "{{baseUrl}}/login" {
		t.Errorf("expected %q, got %v", "{{baseUrl}}/login", got[0].Args["url"])
	}
}

// TestReverseSubstituteRejectsSubstring is the corruption guard: a string that
// contains the variable value as a substring (without a clean boundary) must
// pass through untouched. This is the case that protects CSS selectors and fill
// values from accidental rewriting.
func TestReverseSubstituteRejectsSubstring(t *testing.T) {
	cases := []struct {
		name string
		val  string
	}{
		{"email-like", "user@demo.thani.sh"},
		{"selector-like", "div.demo.thani.sh-banner"},
		{"mid-word", "demo.thani.sh.something"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			actions := []browser.Action{
				{Name: "fill", Args: map[string]any{"value": c.val}},
			}
			vars := map[string]string{"baseUrl": "https://demo.thani.sh/"}
			got := reverseSubstituteActions(actions, vars)
			if got[0].Args["value"] != c.val {
				t.Errorf("expected unchanged %q, got %v", c.val, got[0].Args["value"])
			}
		})
	}
}

// TestReverseSubstituteSkipsEmptyValue catches the empty-value footgun: an
// empty vars["x"] = "" must never replace anything, or we'd rewrite every
// empty-string literal in the script.
func TestReverseSubstituteSkipsEmptyValue(t *testing.T) {
	actions := []browser.Action{
		{Name: "fill", Args: map[string]any{"value": ""}},
		{Name: "fill", Args: map[string]any{"value": "literal"}},
	}
	vars := map[string]string{"empty_var": ""}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["value"] != "" {
		t.Errorf("empty args must be preserved, got %v", got[0].Args["value"])
	}
	if got[1].Args["value"] != "literal" {
		t.Errorf("non-empty literal must be preserved, got %v", got[1].Args["value"])
	}
}

// TestReverseSubstituteLongestValueWins verifies ordering: when two vars have
// overlapping values, the more-specific (longer) var wins. This prevents
// "demo" from matching "demo.thani.sh" and producing a placeholder that doesn't
// represent the actual URL.
func TestReverseSubstituteLongestValueWins(t *testing.T) {
	actions := []browser.Action{
		{Name: "navigate", Args: map[string]any{"url": "https://demo.thani.sh/"}},
	}
	vars := map[string]string{
		"short": "demo",
		"long":  "https://demo.thani.sh/",
	}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["url"] != "{{long}}" {
		t.Errorf("expected longest match %q, got %v", "{{long}}", got[0].Args["url"])
	}
}

// TestReverseSubstitutePassesNonString guards against panics when an action arg
// isn't a string. (Today's tools only emit string args, but the substitution
// pass shouldn't crash if that ever changes.)
func TestReverseSubstitutePassesNonString(t *testing.T) {
	actions := []browser.Action{
		{Name: "wait_for", Args: map[string]any{"timeout": 5, "selector": "body"}},
	}
	vars := map[string]string{"baseUrl": "https://demo.thani.sh/"}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["timeout"] != 5 {
		t.Errorf("non-string arg should be untouched, got %v", got[0].Args["timeout"])
	}
	if got[0].Args["selector"] != "body" {
		t.Errorf("unrelated selector should be untouched, got %v", got[0].Args["selector"])
	}
}

// TestReverseSubstituteNoVars confirms the pass is a no-op when no vars are
// declared — no panics, no spurious rewriting.
func TestReverseSubstituteNoVars(t *testing.T) {
	actions := []browser.Action{
		{Name: "navigate", Args: map[string]any{"url": "https://demo.thani.sh/"}},
	}
	got := reverseSubstituteActions(actions, nil)
	if got[0].Args["url"] != "https://demo.thani.sh/" {
		t.Errorf("with nil vars the arg must be untouched, got %v", got[0].Args["url"])
	}
}

// TestReverseSubstituteNoTrailingSlashGuard: when the value has no trailing
// slash, a prefix match is only accepted if the next character in s is a URL
// separator. "demo" + "thani.sh" must NOT match because "t" is not a separator.
func TestReverseSubstituteNoTrailingSlashGuard(t *testing.T) {
	actions := []browser.Action{
		{Name: "navigate", Args: map[string]any{"url": "demo-thani.sh"}},
	}
	vars := map[string]string{"host": "demo"}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["url"] != "demo-thani.sh" {
		t.Errorf("coincidental substring must not be substituted, got %v", got[0].Args["url"])
	}
}

// TestReverseSubstituteURLSeparatorAccepts verifies the same var does match
// when the next character is a real URL separator.
func TestReverseSubstituteURLSeparatorAccepts(t *testing.T) {
	actions := []browser.Action{
		{Name: "navigate", Args: map[string]any{"url": "demo/page"}},
	}
	vars := map[string]string{"host": "demo"}
	got := reverseSubstituteActions(actions, vars)
	if got[0].Args["url"] != "{{host}}/page" {
		t.Errorf("expected %q, got %v", "{{host}}/page", got[0].Args["url"])
	}
}
