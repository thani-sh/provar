package bindings

import (
	"fmt"
	"os"
	"path/filepath"

	"go.yaml.in/yaml/v4"
)

const (
	provarDir       = ".provar"
	historyFilename = "history.yml"
	historyCap      = 10
	dirPerm         = 0o755
	filePerm        = 0o644
)

// History is the desktop app's recent-projects list. Persists to
// ~/.provar/history.yml, separate from the user's settings. The domain
// does not know about this file — it's app state, not user preferences.
type History struct {
	BaseBinding
}

// historyPath returns the absolute path of the history file.
func (h History) historyPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate home: %w", err)
	}
	return filepath.Join(home, provarDir, historyFilename), nil
}

// Recent returns the list of recently opened project paths. Returns an
// empty list (not an error) when the file does not exist yet — the app
// must boot cleanly on a fresh machine.
func (h History) Recent() ([]string, error) {
	path, err := h.historyPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("read history: %w", err)
	}
	var doc struct {
		Recent []string `yaml:"recent"`
	}
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse history: %w", err)
	}
	if doc.Recent == nil {
		return []string{}, nil
	}
	return doc.Recent, nil
}

// Add prepends path, dedupes, and caps the list at historyCap entries.
// Persists back to ~/.provar/history.yml, creating the parent dir and
// the file if missing.
func (h History) Add(path string) error {
	historyPath, err := h.historyPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(historyPath), dirPerm); err != nil {
		return fmt.Errorf("create history dir: %w", err)
	}

	existing, err := h.Recent()
	if err != nil {
		return err
	}
	deduped := make([]string, 0, historyCap)
	deduped = append(deduped, path)
	for _, r := range existing {
		if r == path {
			continue
		}
		deduped = append(deduped, r)
		if len(deduped) >= historyCap {
			break
		}
	}

	data, err := yaml.Marshal(struct {
		Recent []string `yaml:"recent"`
	}{Recent: deduped})
	if err != nil {
		return fmt.Errorf("marshal history: %w", err)
	}
	if err := os.WriteFile(historyPath, data, filePerm); err != nil {
		return fmt.Errorf("write history: %w", err)
	}
	return nil
}
