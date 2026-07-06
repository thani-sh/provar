package domain

import (
	"os"
	"path/filepath"
	"testing"
)

func TestClean(t *testing.T) {
	tempDir := t.TempDir()
	project := &Project{Path: tempDir}

	// Seed VisualDir with one PNG, BaselinesDir with one PNG, and one
	// compiled .test.lua next to a fake .test.yml so each branch has
	// something to operate on.
	mustWrite(t, filepath.Join(tempDir, VisualDir, "login.png"), "current")
	mustWrite(t, filepath.Join(tempDir, BaselinesDir, "login.png"), "baseline")
	project.Files = []File{{Path: ".provar/tests/login.test.yml"}}
	compiledLua := ".provar/tests/login.test.lua"
	mustMkdirAll(t, filepath.Join(tempDir, ".provar/tests"))
	mustWrite(t, filepath.Join(tempDir, compiledLua), "compiled")

	cases := []struct {
		name           string
		opts           CleanOptions
		wantGone       []string // paths expected to be removed after the call
		wantLeft       []string // paths expected to still exist after the call
		action         CleanAction
		scope          int  // expected number of result items
		resetVisual    bool // whether to seed VisualDir before this case
		resetBaselines bool // whether to seed BaselinesDir before this case
		resetLua       bool // whether to seed the compiled .test.lua before this case
	}{
		{
			name: "DryRun touches nothing and would-remove everything opted-in",
			opts: CleanOptions{IncludeBaselines: true, IncludeLua: true, DryRun: true},
			wantLeft: []string{
				filepath.Join(tempDir, VisualDir, "login.png"),
				filepath.Join(tempDir, BaselinesDir, "login.png"),
				filepath.Join(tempDir, compiledLua),
			},
			scope:          3,
			resetVisual:    true,
			resetBaselines: true,
			resetLua:       true,
		},
		{
			name:           "default keeps baselines and compiled lua",
			opts:           CleanOptions{},
			wantGone:       []string{filepath.Join(tempDir, VisualDir, "login.png")},
			wantLeft:       []string{filepath.Join(tempDir, BaselinesDir, "login.png"), filepath.Join(tempDir, compiledLua)},
			scope:          1,
			resetVisual:    true,
			resetBaselines: true,
			resetLua:       true,
		},
		{
			name:           "IncludeBaselines wipes baselines too",
			opts:           CleanOptions{IncludeBaselines: true},
			wantGone:       []string{filepath.Join(tempDir, VisualDir, "login.png"), filepath.Join(tempDir, BaselinesDir, "login.png")},
			wantLeft:       []string{filepath.Join(tempDir, compiledLua)},
			scope:          2,
			resetVisual:    true,
			resetBaselines: true,
			resetLua:       true,
		},
		{
			name:           "IncludeLua wipes compiled lua too",
			opts:           CleanOptions{IncludeLua: true},
			wantGone:       []string{filepath.Join(tempDir, VisualDir, "login.png"), filepath.Join(tempDir, compiledLua)},
			wantLeft:       []string{filepath.Join(tempDir, BaselinesDir, "login.png")},
			scope:          2,
			resetVisual:    true,
			resetBaselines: true,
			resetLua:       true,
		},
		{
			name:   "missing VisualDir emits a not-found row, no error",
			opts:   CleanOptions{},
			scope:  1, // single not-found row for the absent VisualDir
			action: CleanActionNotFound,
			// No reset for this case — VisualDir stays absent across the
			// prior case's reset, so we don't recreate it.
			resetVisual:    false,
			resetBaselines: true,
			resetLua:       true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Reset fixtures before each case so test order doesn't matter.
			if tc.resetVisual {
				mustWrite(t, filepath.Join(tempDir, VisualDir, "login.png"), "current")
			}
			if tc.resetBaselines {
				mustWrite(t, filepath.Join(tempDir, BaselinesDir, "login.png"), "baseline")
			}
			if tc.resetLua {
				mustWrite(t, filepath.Join(tempDir, compiledLua), "compiled")
			}

			result, err := Clean(project, tc.opts)
			if err != nil {
				t.Fatalf("Clean: %v", err)
			}
			if len(result.Items) != tc.scope {
				t.Fatalf("want %d items, got %d (%v)", tc.scope, len(result.Items), result.Items)
			}
			if tc.action != "" && result.Items[0].Action != tc.action {
				t.Fatalf("want first action %q, got %q", tc.action, result.Items[0].Action)
			}
			for _, p := range tc.wantGone {
				if _, err := os.Stat(p); err == nil {
					t.Errorf("want %s gone, still present", p)
				} else if !os.IsNotExist(err) {
					t.Errorf("unexpected stat error for %s: %v", p, err)
				}
			}
			for _, p := range tc.wantLeft {
				if _, err := os.Stat(p); err != nil {
					t.Errorf("want %s left, got %v", p, err)
				}
			}
		})
	}
}

// TestCleanMissingPerFileLuaStaysQuiet covers the per-file lua branch:
// when a project lists a .test.yml that has no compiled sibling, Clean
// silently skips it (no row in the result, no error). This matches the
// prior CLI behavior of `continue`-ing on stat failure for per-file lua.
func TestCleanMissingPerFileLuaStaysQuiet(t *testing.T) {
	tempDir := t.TempDir()
	project := &Project{
		Path:  tempDir,
		Files: []File{{Path: ".provar/tests/no-such.test.yml"}},
	}
	mustWrite(t, filepath.Join(tempDir, VisualDir, "x.png"), "current")
	result, err := Clean(project, CleanOptions{IncludeLua: true})
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	// One row: the VisualDir (removed). The phantom .test.lua contributes
	// nothing because Stat returned ErrNotExist and inspect skips silently.
	if len(result.Items) != 1 {
		t.Fatalf("want 1 item, got %d (%v)", len(result.Items), result.Items)
	}
	if result.Items[0].Action != CleanActionRemoved {
		t.Fatalf("want removed, got %q", result.Items[0].Action)
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), dirPerm); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), filePerm); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, dirPerm); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
}
