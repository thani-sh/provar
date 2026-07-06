package commands

import (
	"context"
	"os"
	"path/filepath"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
)

// cleanFlags control what clean removes. By default it skips baselines so
// the user doesn't blow away their visual regression references by accident.
type cleanFlags struct {
	IncludeBaselines bool `flag:"include-baselines" validate:"-"`
	IncludeLua       bool `flag:"include-lua" validate:"-"`
	DryRun           bool `flag:"dry-run" validate:"-"`
}

func (f *cleanFlags) Validate() error { return helpers.ValidateStruct(f) }

var cleanFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{
		{Name: "include-baselines"},
		{Name: "include-lua"},
		{Name: "dry-run"},
	},
	New: func() helpers.Flags { return &cleanFlags{} },
}

var cleanCmd = helpers.Command{
	Name:        "clean",
	Summary:     "Remove generated artifacts from the project",
	Flags:       cleanFlagBinding,
	NeedsTarget: true,
	Run:         cleanHandler,
}

// cleanHandler implements `provar clean <target> [--include-baselines] [--include-lua] [--dry-run]`.
// Always removes the current-run screenshots (visualDir); baselines are kept
// unless --include-baselines is set; compiled .test.lua files are kept unless
// --include-lua is set (so users can keep compiling without losing baselines
// while iterating).
func cleanHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = ctx
	fl := raw.(*cleanFlags)
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	type cleanTarget struct {
		path   string
		label  string
		always bool
	}
	targets := []cleanTarget{
		{path: filepath.Join(project.Path, domain.VisualDir), label: "current screenshots", always: true},
		{path: filepath.Join(project.Path, domain.BaselinesDir), label: "baselines", always: false},
	}
	for _, t := range targets {
		if !t.always && !(fl.IncludeBaselines && t.label == "baselines") {
			continue
		}
		if _, err := os.Stat(t.path); err != nil {
			if os.IsNotExist(err) {
				p.Info("skip %s (%s not found)", t.label, t.path)
				continue
			}
			p.Error("%s: %v", t.label, err)
			continue
		}
		if fl.DryRun {
			p.Info("would remove %s (%s)", t.label, t.path)
			continue
		}
		if err := os.RemoveAll(t.path); err != nil {
			p.Error("remove %s: %v", t.label, err)
			continue
		}
		p.Success("removed %s (%s)", t.label, t.path)
	}
	if fl.IncludeLua {
		for _, f := range project.Files {
			luaPath := filepath.Join(project.Path, trimYml(f.Path)+".test.lua")
			if _, err := os.Stat(luaPath); err != nil {
				continue
			}
			if fl.DryRun {
				p.Info("would remove compiled %s", luaPath)
				continue
			}
			if err := os.Remove(luaPath); err != nil {
				p.Error("remove %s: %v", luaPath, err)
				continue
			}
			p.Success("removed compiled %s", luaPath)
		}
	}
	return int(helpers.ExitSuccess)
}
