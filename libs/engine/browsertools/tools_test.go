package browsertools

import (
	"strings"
	"testing"
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

		// Should pass: real values, including the placeholder form
		{"navigate", "url", "https://demo.thani.sh/", false},
		{"navigate", "url", "{{baseUrl}}", false},
		{"navigate", "url", "{{baseUrl}}/login", false},
		{"click", "selector", "#submit", false},
		{"click", "selector", "input[type='text']", false},
		{"fill", "selector", "#username", false},
		{"wait_for", "selector", "body", false},

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
