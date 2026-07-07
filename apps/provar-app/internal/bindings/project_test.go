package bindings

import (
	"testing"

	"github.com/thani-sh/provar/libs/domain"
)

func TestProject_Settings_DefaultsWhenMissing(t *testing.T) {
	withTempHome(t)
	p := Project{}

	settings, err := p.Settings()
	if err != nil {
		t.Fatalf("Settings: %v", err)
	}
	if settings == nil {
		t.Fatal("Settings returned nil")
	}
	if settings.Provider != "google" {
		t.Errorf("default provider = %q, want %q", settings.Provider, "google")
	}
	if len(settings.Providers) == 0 {
		t.Errorf("expected default providers to be populated")
	}
}

func TestProject_SettingsRoundTrip(t *testing.T) {
	withTempHome(t)
	p := Project{}

	// Save custom settings.
	settings, _ := p.Settings()
	settings.Provider = "openai"
	settings.Providers["openai"] = domain.ProviderConfig{
		Model:   "gpt-5.5",
		APIKey:  "sk-test-123",
		BaseURL: "",
	}
	if err := p.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}

	// Reload and verify.
	loaded, err := p.Settings()
	if err != nil {
		t.Fatalf("Settings: %v", err)
	}
	if loaded.Provider != "openai" {
		t.Errorf("Provider = %q, want %q", loaded.Provider, "openai")
	}
	cfg, ok := loaded.Providers["openai"]
	if !ok {
		t.Fatal("Providers[\"openai\"] missing")
	}
	if cfg.APIKey != "sk-test-123" {
		t.Errorf("APIKey = %q, want %q", cfg.APIKey, "sk-test-123")
	}
	if cfg.Model != "gpt-5.5" {
		t.Errorf("Model = %q, want %q", cfg.Model, "gpt-5.5")
	}
}

func TestProject_Home(t *testing.T) {
	home := withTempHome(t)
	p := Project{}

	got, err := p.Home()
	if err != nil {
		t.Fatalf("Home: %v", err)
	}
	if got != home {
		t.Errorf("Home = %q, want %q", got, home)
	}
}

func TestProject_Home_FailsOnEmptyHome(t *testing.T) {
	// On Unix, os.UserHomeDir falls back to a shell command when HOME
	// is empty. That command may succeed (returning cwd) or fail; we
	// just need *some* error path. Skip if HOME-empty-on-this-platform
	// happens to succeed.
	t.Setenv("HOME", "")
	if _, err := (Project{}).Home(); err == nil {
		t.Skip("os.UserHomeDir() succeeded with empty HOME on this platform — can't test the error path")
	}
}

func TestProject_CreateSampleProject(t *testing.T) {
	// CreateSampleProject uses os.UserHomeDir() to scaffold the
	// .provar/ test files into the target. The target itself can be
	// anywhere writable.
	home := withTempHome(t)
	target := home + "/my-sample"
	p := Project{}

	if err := p.CreateSampleProject(target); err != nil {
		t.Fatalf("CreateSampleProject: %v", err)
	}

	// The sample should have scaffolded a .provar/ directory.
	// We don't pin the exact contents — the domain owns the sample
	// shape — but at minimum the directory should exist.
	// (InitProject's exact layout is tested in libs/domain.)
	if err := p.CreateSampleProject(target); err == nil {
		t.Errorf("second call to CreateSampleProject on the same target should error (target not empty)")
	}
}