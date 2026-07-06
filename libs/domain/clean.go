package domain

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// CleanOptions controls what Clean removes from a project. By default only
// the current-run screenshots (VisualDir) are removed — baselines and
// compiled .test.lua files are kept unless the matching flag is set so a
// user iterating on visual regression doesn't lose the reference images
// or the compiled output of unchanged files. DryRun reports what would
// have happened without touching disk.
type CleanOptions struct {
	IncludeBaselines bool
	IncludeLua       bool
	DryRun           bool
}

// CleanAction is one row's outcome in a Clean call. Every inspected target
// gets exactly one of these so the caller can render a stable, ordered
// status list.
type CleanAction string

const (
	CleanActionRemoved     CleanAction = "removed"
	CleanActionWouldRemove CleanAction = "would-remove"
	CleanActionNotFound    CleanAction = "not-found"
)

// CleanItem describes one inspected artifact. Label is a human-readable
// name ("current screenshots", "baselines", or "<basename>.test.lua");
// Path is the absolute filesystem location that was (or would have been)
// touched. Every inspected target produces one item, including not-found
// targets — the caller decides whether to surface a missing directory at
// all.
type CleanItem struct {
	Label  string
	Path   string
	Action CleanAction
}

// CleanResult is the structured outcome of Clean. Iteration order matches
// inspection order: directories first (VisualDir, then BaselinesDir), then
// per-file compiled .test.lua entries (one per file in project.Files).
type CleanResult struct {
	Items []CleanItem
}

// Clean removes generated artifacts from project according to opts.
// Always inspects VisualDir; also inspects BaselinesDir when
// IncludeBaselines is set, and every compiled .test.lua next to a
// project file when IncludeLua is set. DryRun reports without touching
// disk. Returns a CleanResult with one item per inspection; callers
// iterate the items to render their own output.
func Clean(project *Project, opts CleanOptions) (*CleanResult, error) {
	result := &CleanResult{}
	groups := []struct {
		path  string
		label string
		drop  bool
	}{
		{filepath.Join(project.Path, VisualDir), "current screenshots", true},
		{filepath.Join(project.Path, BaselinesDir), "baselines", opts.IncludeBaselines},
	}
	for _, g := range groups {
		if !g.drop {
			continue
		}
		if err := inspect(&result.Items, g.label, g.path, true /* useRemoveAll */, opts.DryRun); err != nil {
			return nil, err
		}
	}
	if opts.IncludeLua {
		for _, f := range project.Files {
			luaRel := strings.TrimSuffix(f.Path, testFileExtension) + ".test.lua"
			label := filepath.Base(luaRel)
			luaPath := filepath.Join(project.Path, luaRel)
			if err := inspect(&result.Items, label, luaPath, false /* useRemoveAll */, opts.DryRun); err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}

// inspect is the per-artifact loop shared by the directories and the
// per-file lua entries. Records "not-found" silently for directories and
// per-file lua alike (no row appended for per-file lua entries that
// don't exist — keeps the result compact). useRemoveAll picks the right
// deletion primitive: directories need recursive removal, single files do
// not.
func inspect(items *[]CleanItem, label, path string, useRemoveAll, dryRun bool) error {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			// For directories the user asked about, surface the not-found
			// so the caller can decide whether to log it. For per-file lua
			// entries that don't exist yet, no row at all (matches prior
			// CLI behavior of silently skipping).
			if useRemoveAll {
				*items = append(*items, CleanItem{Label: label, Path: path, Action: CleanActionNotFound})
			}
			return nil
		}
		return fmt.Errorf("stat %s: %w", label, err)
	}
	if dryRun {
		*items = append(*items, CleanItem{Label: label, Path: path, Action: CleanActionWouldRemove})
		return nil
	}
	remove := os.Remove
	if useRemoveAll {
		remove = os.RemoveAll
	}
	if err := remove(path); err != nil {
		return fmt.Errorf("remove %s: %w", label, err)
	}
	*items = append(*items, CleanItem{Label: label, Path: path, Action: CleanActionRemoved})
	return nil
}
