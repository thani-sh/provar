package bindings

import (
	"fmt"
	"os"

	"github.com/thani-sh/provar/libs/domain"
)

// Project exposes user-level settings. The recent-projects list lives
// in History, not here.
type Project struct {
	BaseBinding
}

// Home returns the user's home directory. Fails explicitly if it cannot
// be determined — no silent fallback.
func (p Project) Home() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate home: %w", err)
	}
	return home, nil
}

// Settings loads the on-disk settings from ~/.provar/settings.yml.
// A missing file is not an error — the domain returns default settings.
func (p Project) Settings() (*domain.Settings, error) {
	return domain.LoadSettings()
}

// SaveSettings writes s to ~/.provar/settings.yml.
func (p Project) SaveSettings(s *domain.Settings) error {
	return domain.SaveSettings(s)
}

// CreateSampleProject scaffolds the demo-social sample (a 5-step
// login test plus a small local web app) at target. Errors if the
// target directory already contains files.
func (p Project) CreateSampleProject(target string) error {
	return domain.InitProject(target, true, false)
}
