package domain

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"go.yaml.in/yaml/v4"
)

// Project represents the project configuration and directory context.
type Project struct {
	Path  string
	Vars  map[string]string
	Files []File
}

// File represents a test specification file inside a project. Path is relative to the
// project root (e.g. ".provar/tests/auth/login.test.yml"). Actions are not loaded
// eagerly; call ParseFile to read and parse them on demand.
type File struct {
	Path string
}

// Action represents a high-level step of a test sequence.
type Action struct {
	ID   string
	Name string
	Info string
	Next []string
}

type projectConfig struct {
	Vars map[string]interface{} `yaml:"variables"`
}

const (
	configSubdir      = ".provar"
	configFilename    = "config.yml"
	testsSubdir       = ".provar/tests"
	testFileExtension = ".test.yml"

	// SampleDemoURL is the live hosted demo the --sample flow points tests at. See ADR 002.
	SampleDemoURL = "https://demo.thani.sh/"
)

const (
	dirPerm  = 0o755
	filePerm = 0o644

	sampleConfigYML = "variables:\n  baseUrl: https://demo.thani.sh/\n"
	emptyConfigYML  = "variables:\n  baseUrl: http://127.0.0.1:3000\n"
	sampleLoginYML  = "- id: open_login_page\n  name: Open Login Page\n  info: Navigate to the demo login page\n- id: enter_credentials\n  name: Enter Credentials\n  info: Enter the demo credentials\n- id: click_login\n  name: Click Login\n  info: Click the submit button\n- id: verify_dashboard\n  name: Verify Dashboard\n  info: Verify the dashboard loaded\n"
)

// LoadProject loads the project configuration and the list of test files from projectDir.
// It reads .provar/config.yml and walks .provar/tests/ for *.test.yml files. Test file
// contents are not parsed here; call ParseFile to read each file's actions on demand.
func LoadProject(projectDir string) (*Project, error) {
	configPath := filepath.Join(projectDir, configSubdir, configFilename)
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg projectConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	project := &Project{
		Path: projectDir,
		Vars: make(map[string]string),
	}
	for k, v := range cfg.Vars {
		strVal := fmt.Sprintf("%v", v)
		if envVal, exists := os.LookupEnv(k); exists {
			strVal = envVal
		}
		project.Vars[k] = strVal
	}
	files, err := loadTestFiles(projectDir)
	if err != nil {
		return nil, err
	}
	project.Files = files
	return project, nil
}

// loadTestFiles walks projectDir/.provar/tests/ for *.test.yml files. Returns nil if the
// tests directory does not exist.
func loadTestFiles(projectDir string) ([]File, error) {
	testsDir := filepath.Join(projectDir, testsSubdir)
	info, err := os.Stat(testsDir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", testsDir)
	}
	var relPaths []string
	walkErr := filepath.WalkDir(testsDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(d.Name(), testFileExtension) {
			return nil
		}
		rel, err := filepath.Rel(projectDir, path)
		if err != nil {
			return err
		}
		relPaths = append(relPaths, rel)
		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}
	sort.Strings(relPaths)
	files := make([]File, 0, len(relPaths))
	for _, rel := range relPaths {
		files = append(files, File{Path: rel})
	}
	return files, nil
}

// ParseFile reads and parses a single test file into a list of actions. The relPath is
// the file's path relative to projectDir (i.e. File.Path).
func ParseFile(projectDir, relPath string) ([]Action, error) {
	data, err := os.ReadFile(filepath.Join(projectDir, relPath))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", relPath, err)
	}
	var actions []Action
	if err := yaml.Unmarshal(data, &actions); err != nil {
		return nil, fmt.Errorf("parse %s: %w", relPath, err)
	}
	return actions, nil
}

// InitProject creates a new project at target. If useSample is true, writes a sample
// .test.yml pointing at SampleDemoURL plus a config.yml whose baseUrl is set to it. If
// force is false and target already exists, returns an error; if force is true, removes
// target first. Parent directories of target are created if missing.
func InitProject(target string, useSample, force bool) error {
	if err := validateTarget(target); err != nil {
		return err
	}
	if force {
		if err := os.RemoveAll(target); err != nil {
			return fmt.Errorf("remove existing target: %w", err)
		}
	} else {
		if _, err := os.Stat(target); err == nil {
			return fmt.Errorf("target already exists: %s (use force to overwrite)", target)
		} else if !errors.Is(err, fs.ErrNotExist) {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Join(target, testsSubdir), dirPerm); err != nil {
		return err
	}
	configPath := filepath.Join(target, configSubdir, configFilename)
	if err := os.WriteFile(configPath, []byte(emptyConfigYML), filePerm); err != nil {
		return err
	}
	if !useSample {
		return nil
	}
	if err := os.WriteFile(configPath, []byte(sampleConfigYML), filePerm); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(target, testsSubdir, "login.test.yml"), []byte(sampleLoginYML), filePerm)
}

// validateTarget rejects paths that would be dangerous with force=true (filesystem root,
// current dir, parent dir, empty string).
func validateTarget(target string) error {
	if target == "" {
		return errors.New("target path is empty")
	}
	cleaned := filepath.Clean(target)
	if cleaned == "/" || cleaned == "." || cleaned == ".." {
		return fmt.Errorf("refusing to init at %q", cleaned)
	}
	return nil
}
