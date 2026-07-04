package domain

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/go-playground/validator/v10"
	"go.yaml.in/yaml/v4"
)

// Provider identifies which LLM backend the user is configured to use.
type Provider string

const (
	ProviderGoogle    Provider = "google"
	ProviderOpenAI    Provider = "openai"
	ProviderAnthropic Provider = "anthropic"
)

const (
	settingsDir      = ".provar"
	settingsFilename = "settings.yml"
)

// ProviderConfig is the per-provider credential bundle. APIKey is required to be non-empty
// for whichever provider is currently active; the other providers may have empty keys.
type ProviderConfig struct {
	Model   string `yaml:"model"   validate:"required"`
	APIKey  string `yaml:"apiKey"  validate:"omitempty,min=1"`
	BaseURL string `yaml:"baseUrl" validate:"omitempty,url"`
}

// Settings is the full on-disk settings structure, loaded from ~/.provar/settings.yml.
// It holds the active provider and a credential bundle for every supported provider.
// The active provider must have a non-empty APIKey (enforced by Validate).
type Settings struct {
	Provider  Provider                  `yaml:"provider"  validate:"required,oneof=google openai anthropic"`
	Providers map[string]ProviderConfig `yaml:"providers" validate:"required,min=1,dive"`
}

// LoadSettings reads ~/.provar/settings.yml. A missing file is not an error — the default
// settings are returned instead so first-run users can edit and save.
func LoadSettings() (*Settings, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("locate home directory: %w", err)
	}
	path := filepath.Join(home, settingsDir, settingsFilename)
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return defaultSettings(), nil
		}
		return nil, fmt.Errorf("read settings: %w", err)
	}
	var s Settings
	if err := yaml.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse settings: %w", err)
	}
	return &s, nil
}

// Validate runs the struct-tag rules, then checks that the active provider has an API key
// (a cross-field rule the validator cannot express via tags alone).
func (s *Settings) Validate() error {
	if err := validate.Struct(s); err != nil {
		return err
	}
	cfg, ok := s.Providers[string(s.Provider)]
	if !ok {
		return fmt.Errorf("active provider %q has no configuration entry", s.Provider)
	}
	if cfg.APIKey == "" {
		return fmt.Errorf("active provider %q has no API key configured", s.Provider)
	}
	return nil
}

// validate is the package-level validator instance. WithRequiredStructEnabled is required
// for the "required" tag to fire on struct (non-pointer) fields like Settings.Providers.
var validate = validator.New(validator.WithRequiredStructEnabled())

// defaultSettings is the first-run settings: every supported provider gets a default model,
// Google is active, and no API keys are set. The user edits ~/.provar/settings.yml to add
// the active provider's API key.
func defaultSettings() *Settings {
	return &Settings{
		Provider: ProviderGoogle,
		Providers: map[string]ProviderConfig{
			string(ProviderGoogle):    {Model: "gemini-3.5-flash"},
			string(ProviderOpenAI):    {Model: "gpt-5.5"},
			string(ProviderAnthropic): {Model: "claude-5-sonnet-latest"},
		},
	}
}
