package bindings

import (
	"testing"
)

func TestConfig_LoadConfig_EmptyWhenMissing(t *testing.T) {
	c := Config{}
	got, err := c.LoadConfig(t.TempDir())
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if got == nil {
		t.Fatal("LoadConfig returned nil")
	}
	if len(got) != 0 {
		t.Errorf("expected empty config, got %v", got)
	}
}

func TestConfig_SaveAndLoadRoundTrip(t *testing.T) {
	root := t.TempDir()
	c := Config{}

	cfg := map[string]any{
		"variables": map[string]any{
			"baseUrl": "https://example.com",
			"user":    "alice",
		},
		"browser": map[string]any{
			"width":  1280,
			"height": 720,
		},
	}
	if err := c.SaveConfig(root, cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	loaded, err := c.LoadConfig(root)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	vars, ok := loaded["variables"].(map[string]any)
	if !ok {
		t.Fatalf("variables missing or wrong type: %T", loaded["variables"])
	}
	if vars["baseUrl"] != "https://example.com" {
		t.Errorf("baseUrl = %v, want %q", vars["baseUrl"], "https://example.com")
	}
	if vars["user"] != "alice" {
		t.Errorf("user = %v, want %q", vars["user"], "alice")
	}
}
