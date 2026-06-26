package domain

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Project represents the project configuration and directory context.
type Project struct {
	Path string
	Vars map[string]string
}

// Action represents a high-level step of a test sequence.
type Action struct {
	ID   string
	Name string
	Info string
	Next []string
}

// Scenario represents a sequence of actions representing one execution route.
type Scenario []Action

type projectConfig struct {
	Vars map[string]interface{} `json:"variables"`
}

// LoadProject loads the project configuration from a given project directory path.
// It parses the .provar/config.json file inside projectDir.
func LoadProject(projectDir string) (*Project, error) {
	configPath := filepath.Join(projectDir, ".provar", "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg projectConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	project := &Project{
		Path: projectDir,
		Vars: make(map[string]string),
	}
	if cfg.Vars == nil {
		return project, nil
	}
	for k, v := range cfg.Vars {
		strVal := fmt.Sprintf("%v", v)
		if envVal, exists := os.LookupEnv(k); exists {
			strVal = envVal
		}
		project.Vars[k] = strVal
	}
	return project, nil
}
