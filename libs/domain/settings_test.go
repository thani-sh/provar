package domain

import (
	"os"
	"path/filepath"
	"testing"
)

const (
	testSettingsDir  = ".provar"
	testSettingsFile = "settings.yml"
	testHomeDirEnv   = "HOME"

	testAPIKey        = "test-api-key"
	testInvalidYAML   = "key: \"unclosed"
	testBadURL        = "not-a-url"
	testMissingKeyMsg = "no API key"
)

func TestLoadSettings_MissingReturnsDefaults(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv(testHomeDirEnv, tempHome)
	s, err := LoadSettings()
	if err != nil {
		t.Fatalf("LoadSettings returned error: %v", err)
	}
	if s.Models.Provider != ProviderGoogle {
		t.Errorf("expected default provider %q, got %q", ProviderGoogle, s.Models.Provider)
	}
	if len(s.Models.Providers) != 3 {
		t.Errorf("expected 3 default providers, got %d", len(s.Models.Providers))
	}
}

func TestLoadSettings_OK(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv(testHomeDirEnv, tempHome)
	settingsDir := filepath.Join(tempHome, testSettingsDir)
	if err := os.MkdirAll(settingsDir, dirPerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	content := "models:\n  provider: openai\n  providers:\n    openai:\n      apiKey: sk-test\n      model: gpt-4o\n    google:\n      model: gemini-1.5-flash\n    anthropic:\n      model: claude-3-5-sonnet-latest\n"
	if err := os.WriteFile(filepath.Join(settingsDir, testSettingsFile), []byte(content), filePerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	s, err := LoadSettings()
	if err != nil {
		t.Fatalf("LoadSettings returned error: %v", err)
	}
	if s.Models.Provider != ProviderOpenAI {
		t.Errorf("expected provider %q, got %q", ProviderOpenAI, s.Models.Provider)
	}
	openai, ok := s.Models.Providers[string(ProviderOpenAI)]
	if !ok {
		t.Fatal("expected openai provider entry")
	}
	if openai.APIKey != "sk-test" {
		t.Errorf("expected api key %q, got %q", "sk-test", openai.APIKey)
	}
}

func TestLoadSettings_InvalidYAML(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv(testHomeDirEnv, tempHome)
	settingsDir := filepath.Join(tempHome, testSettingsDir)
	if err := os.MkdirAll(settingsDir, dirPerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if err := os.WriteFile(filepath.Join(settingsDir, testSettingsFile), []byte(testInvalidYAML), filePerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	_, err := LoadSettings()
	if err == nil {
		t.Error("expected error for invalid YAML, got nil")
	}
}

func TestSettings_Validate_OK(t *testing.T) {
	s := &Settings{
		Models: ModelsSettings{
			Provider: ProviderGoogle,
			Providers: map[string]ProviderConfig{
				string(ProviderGoogle):    {APIKey: testAPIKey, Model: "gemini-1.5-flash"},
				string(ProviderOpenAI):    {Model: "gpt-4o"},
				string(ProviderAnthropic): {Model: "claude-3-5-sonnet-latest"},
			},
		},
	}
	if err := s.Validate(); err != nil {
		t.Errorf("expected validation to pass, got %v", err)
	}
}

func TestSettings_Validate_MissingAPIKey(t *testing.T) {
	s := &Settings{
		Models: ModelsSettings{
			Provider: ProviderGoogle,
			Providers: map[string]ProviderConfig{
				string(ProviderGoogle):    {Model: "gemini-1.5-flash"},
				string(ProviderOpenAI):    {Model: "gpt-4o"},
				string(ProviderAnthropic): {Model: "claude-3-5-sonnet-latest"},
			},
		},
	}
	err := s.Validate()
	if err == nil {
		t.Fatal("expected error for missing API key, got nil")
	}
	if !contains(err.Error(), testMissingKeyMsg) {
		t.Errorf("expected error to mention %q, got %q", testMissingKeyMsg, err.Error())
	}
}

func TestSettings_Validate_BadProvider(t *testing.T) {
	s := &Settings{
		Models: ModelsSettings{
			Provider: Provider("unknown-provider"),
			Providers: map[string]ProviderConfig{
				string(ProviderGoogle):    {Model: "gemini-1.5-flash"},
				string(ProviderOpenAI):    {Model: "gpt-4o"},
				string(ProviderAnthropic): {Model: "claude-3-5-sonnet-latest"},
			},
		},
	}
	if err := s.Validate(); err == nil {
		t.Error("expected error for unknown provider, got nil")
	}
}

func TestSettings_Validate_BadURL(t *testing.T) {
	s := &Settings{
		Models: ModelsSettings{
			Provider: ProviderOpenAI,
			Providers: map[string]ProviderConfig{
				string(ProviderGoogle):    {Model: "gemini-1.5-flash"},
				string(ProviderOpenAI):    {APIKey: testAPIKey, Model: "gpt-4o", BaseURL: testBadURL},
				string(ProviderAnthropic): {Model: "claude-3-5-sonnet-latest"},
			},
		},
	}
	if err := s.Validate(); err == nil {
		t.Error("expected error for invalid BaseURL, got nil")
	}
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
