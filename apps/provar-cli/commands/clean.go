package commands

import (
	"context"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
)

// cleanFlags control what clean removes. By default it skips baselines so
// the user doesn't blow away their visual regression references by accident.
type cleanFlags struct {
	IncludeBaselines bool `flag:"include-baselines" validate:"-"`
	IncludeLua       bool `flag:"include-lua"        validate:"-"`
	DryRun           bool `flag:"dry-run"            validate:"-"`
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
// Hands the work to domain.Clean and renders the structured result through
// the CLI's printer — the per-target logic lives in libs/domain so the API
// handler can use the same primitive.
func cleanHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	fl := raw.(*cleanFlags)
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	result, err := domain.Clean(project, domain.CleanOptions{
		IncludeBaselines: fl.IncludeBaselines,
		IncludeLua:       fl.IncludeLua,
		DryRun:           fl.DryRun,
	})
	if err != nil {
		p.Error("%v", err)
		return int(helpers.ExitRuntime)
	}
	for _, item := range result.Items {
		switch item.Action {
		case domain.CleanActionRemoved:
			p.Success("removed %s (%s)", item.Label, item.Path)
		case domain.CleanActionWouldRemove:
			p.Info("would remove %s (%s)", item.Label, item.Path)
		case domain.CleanActionNotFound:
			p.Info("skip %s (%s not found)", item.Label, item.Path)
		}
	}
	return int(helpers.ExitSuccess)
}
