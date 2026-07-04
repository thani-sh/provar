package models

import (
	"reflect"
	"testing"
)

// TestExtractSchemaFields covers the bug where the Anthropic SDK's ToolInputSchemaParam
// silently drops the `required` array if you hand the whole schema as Properties. We
// have to pull the `properties` map and the `required` list out separately and pass
// them as siblings — otherwise the SDK has no way to enforce that `url` is mandatory
// on `navigate`, and the model can emit invalid calls like {"properties": ""}.
func TestExtractSchemaFields(t *testing.T) {
	cases := []struct {
		name         string
		params       map[string]any
		wantProps    map[string]any
		wantRequired []string
	}{
		{
			name: "navigate",
			params: map[string]any{
				"type":       "object",
				"properties": map[string]any{"url": map[string]any{"type": "string"}},
				"required":   []any{"url"},
			},
			wantProps:    map[string]any{"url": map[string]any{"type": "string"}},
			wantRequired: []string{"url"},
		},
		{
			name: "click with multiple required",
			params: map[string]any{
				"type":       "object",
				"properties": map[string]any{"selector": map[string]any{"type": "string"}},
				"required":   []any{"selector"},
			},
			wantProps:    map[string]any{"selector": map[string]any{"type": "string"}},
			wantRequired: []string{"selector"},
		},
		{
			name: "no required field",
			params: map[string]any{
				"type":       "object",
				"properties": map[string]any{"x": map[string]any{"type": "string"}},
			},
			wantProps:    map[string]any{"x": map[string]any{"type": "string"}},
			wantRequired: nil,
		},
		{
			name: "missing properties",
			params: map[string]any{
				"required": []any{"a"},
			},
			wantProps:    map[string]any{},
			wantRequired: []string{"a"},
		},
		{
			name: "non-string required items dropped",
			params: map[string]any{
				"required": []any{"a", 42, "b"},
			},
			wantProps:    map[string]any{},
			wantRequired: []string{"a", "b"},
		},
		{
			name:         "empty params",
			params:       map[string]any{},
			wantProps:    map[string]any{},
			wantRequired: nil,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			props, required := extractSchemaFields(c.params)
			if !reflect.DeepEqual(props, c.wantProps) {
				t.Errorf("props = %#v, want %#v", props, c.wantProps)
			}
			if !reflect.DeepEqual(required, c.wantRequired) {
				t.Errorf("required = %#v, want %#v", required, c.wantRequired)
			}
		})
	}
}
