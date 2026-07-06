package domain

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/go-playground/validator/v10"
	"github.com/thani-sh/provar/libs/models"
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

// SettingsPath returns the absolute path of the user settings file. Useful
// for handlers that need to report where settings live on disk.
func SettingsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate home directory: %w", err)
	}
	return filepath.Join(home, settingsDir, settingsFilename), nil
}

// SaveSettings writes s to ~/.provar/settings.yml, creating the parent
// directory if needed. Validation is the caller's responsibility — SaveSettings
// does not enforce the cross-field rules Validate() does, so callers can write
// partial state (e.g. when editing a single field) and validate afterwards.
func SaveSettings(s *Settings) error {
	path, err := SettingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		return fmt.Errorf("create settings dir: %w", err)
	}
	data, err := yaml.Marshal(s)
	if err != nil {
		return fmt.Errorf("encode settings: %w", err)
	}
	if err := os.WriteFile(path, data, filePerm); err != nil {
		return fmt.Errorf("write settings: %w", err)
	}
	return nil
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

// ModelsClient builds an SDK client for the named provider using cfg's
// credentials, base URL, and model. The domain-side Provider enum and the
// SDK's provider enum share the same string values today, so this is a
// straight cast + construction — but holding the bridge here lets both
// the CLI and the API build a client without each re-implementing the
// mapping (and lets the SDK stay ignorant of the domain enum).
func ModelsClient(p Provider, cfg ProviderConfig) (models.Client, error) {
	var mp models.Provider
	switch p {
	case ProviderGoogle:
		mp = models.Google
	case ProviderOpenAI:
		mp = models.OpenAI
	case ProviderAnthropic:
		mp = models.Anthropic
	}
	return models.NewClient(mp, cfg.APIKey, cfg.BaseURL, cfg.Model)
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
