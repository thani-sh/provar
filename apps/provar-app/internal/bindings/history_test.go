package bindings

import (
	"os"
	"path/filepath"
	"testing"
)

// withTempHome points $HOME at a temp dir for the duration of the test.
// History uses os.UserHomeDir() to locate ~/.provar/history.yml, so
// every History method needs the env override.
func withTempHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	return home
}

func TestHistory_EmptyOnFirstLaunch(t *testing.T) {
	withTempHome(t)
	h := History{}

	recent, err := h.Recent()
	if err != nil {
		t.Fatalf("Recent: %v", err)
	}
	if len(recent) != 0 {
		t.Errorf("got %v, want empty", recent)
	}

	exists, err := h.Exists()
	if err != nil {
		t.Fatalf("Exists: %v", err)
	}
	if exists {
		t.Errorf("Exists = true on first launch, want false")
	}
}

func TestHistory_AddAndRecent(t *testing.T) {
	withTempHome(t)
	h := History{}

	if err := h.Add("/path/to/a"); err != nil {
		t.Fatalf("Add: %v", err)
	}

	recent, err := h.Recent()
	if err != nil {
		t.Fatalf("Recent: %v", err)
	}
	if len(recent) != 1 || recent[0] != "/path/to/a" {
		t.Errorf("got %v, want [/path/to/a]", recent)
	}

	exists, err := h.Exists()
	if err != nil {
		t.Fatalf("Exists: %v", err)
	}
	if !exists {
		t.Errorf("Exists = false after Add, want true")
	}
}

func TestHistory_DedupesAndPrepends(t *testing.T) {
	withTempHome(t)
	h := History{}

	mustAdd(t, h, "/a")
	mustAdd(t, h, "/b")
	mustAdd(t, h, "/a") // duplicate, should move to front

	recent, _ := h.Recent()
	want := []string{"/a", "/b"}
	if len(recent) != 2 || recent[0] != want[0] || recent[1] != want[1] {
		t.Errorf("got %v, want %v", recent, want)
	}
}

func TestHistory_CapsAt10(t *testing.T) {
	withTempHome(t)
	h := History{}

	// Add 12 entries; only the most recent 10 should remain, with
	// the latest at the front.
	for i := 0; i < 12; i++ {
		path := filepath.Join("/path", string(rune('a'+i)))
		mustAdd(t, h, path)
	}

	recent, _ := h.Recent()
	if len(recent) != 10 {
		t.Fatalf("len = %d, want 10", len(recent))
	}
	// Most recent add was 'l' (index 11); it should be at the front.
	wantFront := filepath.Join("/path", "l")
	if recent[0] != wantFront {
		t.Errorf("front = %q, want %q", recent[0], wantFront)
	}
}

func TestHistory_YAMLFormat(t *testing.T) {
	// Sanity check: the file on disk is YAML, not JSON, and is
	// parseable by the YAML library independently.
	home := withTempHome(t)
	h := History{}

	mustAdd(t, h, "/some/path")

	data, err := os.ReadFile(filepath.Join(home, ".provar", "history.yml"))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if want := "recent:\n    - /some/path\n"; string(data) != want {
		t.Errorf("got %q, want %q", string(data), want)
	}
}

func mustAdd(t *testing.T, h History, path string) {
	t.Helper()
	if err := h.Add(path); err != nil {
		t.Fatalf("Add(%q): %v", path, err)
	}
}

func TestHistory_ParseErrorOnCorruptFile(t *testing.T) {
	home := withTempHome(t)
	h := History{}

	// Write malformed YAML into the history file path.
	if err := os.MkdirAll(home+"/.provar", 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(home+"/.provar/history.yml", []byte("recent: [unclosed"), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := h.Recent(); err == nil {
		t.Errorf("expected parse error for malformed YAML")
	}
}
