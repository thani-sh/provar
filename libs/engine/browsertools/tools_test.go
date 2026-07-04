package browsertools

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/models"
)

// TestRequireNonBlank locks in the empty/whitespace rejection across all the
// arg names the wrappers use. The error wording is what the LLM sees — it
// must be specific enough to act on.
func TestRequireNonBlank(t *testing.T) {
	cases := []struct {
		tool, field, value string
		wantErr            bool
	}{
		// Should fail: empty / whitespace-only
		{"navigate", "url", "", true},
		{"navigate", "url", " ", true},
		{"navigate", "url", "\t", true},
		{"navigate", "url", "  \n  ", true},
		{"click", "selector", "", true},
		{"fill", "selector", "", true},
		{"wait_for", "selector", "", true},
		{"assert_exists", "selector", "", true},

		// Should pass: real values, including the placeholder form
		{"navigate", "url", "https://demo.thani.sh/", false},
		{"navigate", "url", "{{baseUrl}}", false},
		{"navigate", "url", "{{baseUrl}}/login", false},
		{"click", "selector", "#submit", false},
		{"click", "selector", "input[type='text']", false},
		{"fill", "selector", "#username", false},
		{"wait_for", "selector", "body", false},
		{"assert_exists", "selector", `input[placeholder="Password"]`, false},

		// requireNonBlank treats every (tool, field) the same way; the policy
		// of "empty value is allowed for fill because it clears the field"
		// lives at the fillTool call site — it simply does NOT call
		// requireNonBlank for fill's value. So we don't test that case here.
	}
	for _, c := range cases {
		t.Run(c.tool+"/"+c.field+"/"+c.value, func(t *testing.T) {
			err := requireNonBlank(c.tool, c.field, c.value)
			gotErr := err != nil
			if gotErr != c.wantErr {
				t.Errorf("requireNonBlank(%q, %q, %q) err = %v, want err = %v",
					c.tool, c.field, c.value, err, c.wantErr)
			}
			if gotErr {
				msg := err.Error()
				// Sanity check on the error wording.
				if !strings.Contains(msg, c.tool) {
					t.Errorf("error should mention the tool name %q, got %q", c.tool, msg)
				}
				if !strings.Contains(msg, c.field) {
					t.Errorf("error should mention the field %q, got %q", c.field, msg)
				}
			}
		})
	}
}

// TestAssertExistsToolRejectsBlank verifies the new assert_exists tool wrapper
// applies the same blank-arg guard as the rest — it doesn't talk to a browser,
// it just has to bail with a clear refusal when the LLM emits empty selector.
func TestAssertExistsToolRejectsBlank(t *testing.T) {
	tool := &assertExistsTool{}
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"selector":"   "}`))
	if err != nil {
		t.Fatalf("Execute should not return a Go error for a bad-arg refusal, got %v", err)
	}
	if len(result.Content) != 1 || result.Content[0].Type != models.AttachmentTypeText {
		t.Fatalf("expected one text attachment, got %+v", result.Content)
	}
	msg := result.Content[0].Text
	if !strings.Contains(msg, "assert_exists") || !strings.Contains(msg, "selector") {
		t.Errorf("refusal should name tool and field, got %q", msg)
	}
}

// TestToolsIncludesAssertExists locks the public toolset: assert_exists must be
// present so the LLM sees it. Reordering or dropping it would silently take the
// assertion option away from the model.
func TestToolsIncludesAssertExists(t *testing.T) {
	got := Tools((*browser.Session)(nil))
	want := "assert_exists"
	names := make([]string, len(got))
	for i, t := range got {
		names[i] = t.Name()
		if t.Name() == want {
			return
		}
	}
	t.Errorf("Tools() should include %q, got %v", want, names)
}
