package bindings

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/thani-sh/provar/libs/domain"
	"provar-app/internal/testfile"
)

const testFileExt = ".test.yml"

// File handles filesystem operations for test files. All methods
// work on paths relative to an explicit project root, never on the
// process's current working directory.
type File struct {
	BaseBinding
}

// LoadProject reads the project at root and returns the populated
// domain.Project. The frontend uses this to get the project's test
// file list and browser config without re-walking the directory.
func (f File) LoadProject(root string) (*domain.Project, error) {
	return domain.LoadProject(root)
}

// ListTests returns every test file under root, paths relative to root.
func (f File) ListTests(root string) ([]string, error) {
	var out []string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, testFileExt) {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		out = append(out, rel)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("list tests: %w", err)
	}
	return out, nil
}

// ReadTestFile parses the test file at projectDir/relPath and returns
// the canvas-facing view. The frontend never parses the file itself.
func (f File) ReadTestFile(projectDir, relPath string) (*testfile.View, error) {
	actions, err := domain.ParseFile(projectDir, relPath)
	if err != nil {
		return nil, err
	}
	view := testfile.FromActions(actions)
	return &view, nil
}

// WriteTestFile persists a canvas view back to disk as a YAML action
// list. The view is converted to actions before saving.
func (f File) WriteTestFile(projectDir, relPath string, view *testfile.View) error {
	if view == nil {
		return fmt.Errorf("write test file: view is nil")
	}
	actions := testfile.ToActions(*view)
	return domain.SaveFile(projectDir, relPath, actions)
}

// CreateFile creates an empty file at path.
func (f File) CreateFile(path string) error {
	if err := os.WriteFile(path, []byte{}, 0o644); err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	return nil
}

// CreateDirectory creates a directory at path (mkdir -p semantics).
func (f File) CreateDirectory(path string) error {
	if err := os.MkdirAll(path, 0o755); err != nil {
		return fmt.Errorf("create directory: %w", err)
	}
	return nil
}

// DeletePath removes a file or directory (recursively).
func (f File) DeletePath(path string) error {
	if err := os.RemoveAll(path); err != nil {
		return fmt.Errorf("delete path: %w", err)
	}
	return nil
}
