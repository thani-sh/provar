package bindings

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/thani-sh/provar/libs/domain"
	"provar-app/internal/testfile"
)

func TestListTests(t *testing.T) {
	tmp := t.TempDir()
	mustWrite(t, filepath.Join(tmp, "a.test.yml"), "- id: a\n")
	mustWrite(t, filepath.Join(tmp, "b.test.yml"), "- id: b\n")
	mustWrite(t, filepath.Join(tmp, "notes.txt"), "not a test file")
	mustMkdir(t, filepath.Join(tmp, "sub"))
	mustWrite(t, filepath.Join(tmp, "sub", "c.test.yml"), "- id: c\n")
	mustMkdir(t, filepath.Join(tmp, "empty"))
	mustMkdir(t, filepath.Join(tmp, "deep"))
	mustWrite(t, filepath.Join(tmp, "deep", "d.test.yml"), "- id: d\n")

	f := File{}
	got, err := f.ListTests(tmp)
	if err != nil {
		t.Fatalf("ListTests: %v", err)
	}

	want := []string{"a.test.yml", "b.test.yml", "deep/d.test.yml", "sub/c.test.yml"}
	slices.Sort(got)
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestListTests_EmptyDir(t *testing.T) {
	f := File{}
	got, err := f.ListTests(t.TempDir())
	if err != nil {
		t.Fatalf("ListTests: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty, got %v", got)
	}
}

func TestListTests_NonExistentRoot(t *testing.T) {
	f := File{}
	if _, err := f.ListTests("/this/path/does/not/exist"); err == nil {
		t.Errorf("expected error for non-existent root")
	}
}

func TestCreateFileAndDeletePath(t *testing.T) {
	tmp := t.TempDir()
	f := File{}
	path := filepath.Join(tmp, "new.txt")

	if err := f.CreateFile(path); err != nil {
		t.Fatalf("CreateFile: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("file not created: %v", err)
	}

	if err := f.DeletePath(path); err != nil {
		t.Fatalf("DeletePath: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestCreateDirectory(t *testing.T) {
	tmp := t.TempDir()
	f := File{}
	nested := filepath.Join(tmp, "a", "b", "c")

	if err := f.CreateDirectory(nested); err != nil {
		t.Fatalf("CreateDirectory: %v", err)
	}
	if info, err := os.Stat(nested); err != nil {
		t.Errorf("directory not created: %v", err)
	} else if !info.IsDir() {
		t.Errorf("not a directory")
	}
}

func TestDeletePath_RemovesRecursively(t *testing.T) {
	tmp := t.TempDir()
	root := filepath.Join(tmp, "root")
	mustMkdir(t, root)
	mustWrite(t, filepath.Join(root, "a.txt"), "a")
	mustMkdir(t, filepath.Join(root, "sub"))
	mustWrite(t, filepath.Join(root, "sub", "b.txt"), "b")

	f := File{}
	if err := f.DeletePath(root); err != nil {
		t.Fatalf("DeletePath: %v", err)
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Errorf("directory still exists")
	}
}

func TestReadWriteTestFile_RoundTrip(t *testing.T) {
	tmp := t.TempDir()
	f := File{}
	rel := "auth/login.test.yml"

	// Build a view with one action.
	view := testfile.FromActions([]domain.Action{
		{ID: "open_login", Name: "Open Login", Info: "navigate"},
	})
	view.Graph.Start = testfile.GraphStartID
	view.Order = []string{"open_login"}

	if err := f.WriteTestFile(tmp, rel, &view); err != nil {
		t.Fatalf("WriteTestFile: %v", err)
	}

	got, err := f.ReadTestFile(tmp, rel)
	if err != nil {
		t.Fatalf("ReadTestFile: %v", err)
	}
	if got.Graph.Nodes["open_login"].Title != "Open Login" {
		t.Errorf("title = %q, want %q", got.Graph.Nodes["open_login"].Title, "Open Login")
	}
	if got.Graph.Start != testfile.GraphStartID {
		t.Errorf("start = %q, want %q", got.Graph.Start, testfile.GraphStartID)
	}
}

func TestReadTestFile_NotFound(t *testing.T) {
	f := File{}
	_, err := f.ReadTestFile(t.TempDir(), "missing.test.yml")
	if err == nil {
		t.Errorf("expected error for missing file")
	}
}

func TestLoadProject_NotFound(t *testing.T) {
	f := File{}
	_, err := f.LoadProject("/this/path/does/not/exist")
	if err == nil {
		t.Errorf("expected error for non-existent project")
	}
}

func TestCreateFile_PathIsDirectory(t *testing.T) {
	// WriteFile fails when the path is an existing directory. The
	// binding should propagate that as an error, not silently succeed.
	f := File{}
	dir := t.TempDir()
	if err := f.CreateFile(dir); err == nil {
		t.Errorf("expected error when creating a file at a directory path")
	}
}

func TestWriteTestFile_NilView(t *testing.T) {
	f := File{}
	if err := f.WriteTestFile(t.TempDir(), "x.test.yml", nil); err == nil {
		t.Errorf("expected error for nil view")
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func mustMkdir(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
}
