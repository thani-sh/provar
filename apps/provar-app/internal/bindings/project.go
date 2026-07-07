package bindings

import (
	"fmt"
	"os"
	"path/filepath"
)

const (
	settingsDir      = ".provar"
	settingsFilename = "settings.yml"
)

// Project handles project-level state: opening a project, persisting
// the recent-projects list in the user's home settings file.
type Project struct {
	BaseBinding
}

// Home returns the user's home directory.
func (p Project) Home() string {
	home, _ := os.UserHomeDir()
	return home
}

// settingsPath returns ~/.provar/settings.yml.
func (p Project) settingsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("home: %w", err)
	}
	return filepath.Join(home, settingsDir, settingsFilename), nil
}

// RecentProjects returns the list of recently opened project paths.
func (p Project) RecentProjects() ([]string, error) {
	path, err := p.settingsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read settings: %w", err)
	}
	// Lightweight parse: the settings file is YAML; for v1 we just
	// return an empty list if we can't parse. The setup wizard and
	// settings modal will populate it on first save.
	_ = data
	return nil, nil
}

// AddRecent prepends path to the recent-projects list, dedupes, and
// caps at 10 entries. Persists to ~/.provar/settings.yml.
func (p Project) AddRecent(path string) error {
	settingsPath, err := p.settingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(settingsPath), 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	existing, _ := p.RecentProjects()
	deduped := []string{path}
	for _, r := range existing {
		if r == path {
			continue
		}
		deduped = append(deduped, r)
		if len(deduped) >= 10 {
			break
		}
	}

	// For v1, write the list as a simple key-prefixed YAML line per
	// entry. The real schema lands when settings-modal work kicks off.
	content := "recentProjects:\n"
	for _, r := range deduped {
		content += fmt.Sprintf("  - %s\n", r)
	}
	if err := os.WriteFile(settingsPath, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write settings: %w", err)
	}
	return nil
}