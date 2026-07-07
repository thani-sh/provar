package bindings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config handles project-level configuration: .provar/config.yml in
// the project root.
type Config struct {
	BaseBinding
}

// configPath returns {projectRoot}/.provar/config.yml.
func (c Config) configPath(projectRoot string) string {
	return filepath.Join(projectRoot, ".provar", "config.yml")
}

// LoadConfig reads the project config. Returns an empty object if
// the file doesn't exist yet.
func (c Config) LoadConfig(projectRoot string) (map[string]any, error) {
	data, err := os.ReadFile(c.configPath(projectRoot))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{}, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}
	var out map[string]any
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return out, nil
}

// SaveConfig writes the project config. Creates .provar/ if missing.
func (c Config) SaveConfig(projectRoot string, config map[string]any) error {
	path := c.configPath(projectRoot)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	return nil
}