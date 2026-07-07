package bindings

import (
	"github.com/thani-sh/provar/libs/domain"
)

// Config handles project-level configuration: .provar/config.yml in
// the project root. Delegates to libs/domain for the actual I/O.
type Config struct {
	BaseBinding
}

// LoadConfig reads the project config. Returns an empty object if the
// file doesn't exist yet.
func (c Config) LoadConfig(projectRoot string) (map[string]any, error) {
	return domain.LoadConfig(projectRoot)
}

// SaveConfig writes the project config. Creates .provar/ if missing.
func (c Config) SaveConfig(projectRoot string, config map[string]any) error {
	return domain.SaveConfig(projectRoot, config)
}
