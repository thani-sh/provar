package bindings

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/thani-sh/provar/libs/domain"
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

// ReadTestFile returns the file's contents as a string.
func (f File) ReadTestFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read test file: %w", err)
	}
	return string(data), nil
}

// WriteTestFile persists content to path, creating it if missing.
func (f File) WriteTestFile(path string, content string) error {
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write test file: %w", err)
	}
	return nil
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
