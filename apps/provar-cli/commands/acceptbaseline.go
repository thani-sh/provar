package commands

import (
	"context"
	"os"
	"path/filepath"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
)

// acceptBaselineFlags are the typed flags for the accept-baseline command.
// File is the basename of the .test.yml (e.g. "login") whose screenshots
// should be promoted. If empty, every file in the project with screenshots
// gets promoted in one shot.
type acceptBaselineFlags struct {
	File string `flag:"file" validate:"omitempty,regexp=^[A-Za-z0-9._/-]+$"`
}

func (f *acceptBaselineFlags) Validate() error { return helpers.ValidateStruct(f) }

var acceptBaselineFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{
		{Name: "file", HasValue: true},
	},
	New: func() helpers.Flags { return &acceptBaselineFlags{} },
}

var acceptBaselineCmd = helpers.Command{
	Name:        "accept-baseline",
	Summary:     "Promote the latest screenshots to visual baselines",
	Flags:       acceptBaselineFlagBinding,
	NeedsTarget: true,
	Run:         acceptBaselineHandler,
}

// acceptBaselineHandler implements `provar accept-baseline <target> [--file <name>]`. Copies
// every PNG in .provar/visual/<file>/*.png to .provar/baselines/<file>/*.png. With no
// --file flag, processes every test file that has screenshots.
func acceptBaselineHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = ctx
	fl := raw.(*acceptBaselineFlags)
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	visualRoot := filepath.Join(project.Path, domain.VisualDir)
	if _, err := os.Stat(visualRoot); err != nil {
		if os.IsNotExist(err) {
			p.Error("no screenshots found at %s — run `provar run` first", visualRoot)
			return int(helpers.ExitRuntime)
		}
		p.Error("%v", err)
		return int(helpers.ExitRuntime)
	}
	dirs, err := os.ReadDir(visualRoot)
	if err != nil {
		p.Error("%v", err)
		return int(helpers.ExitRuntime)
	}
	var eligible []string
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		if fl.File != "" && d.Name() != fl.File {
			continue
		}
		eligible = append(eligible, d.Name())
	}
	if len(eligible) == 0 {
		if fl.File != "" {
			p.Error("no screenshots for --file %q", fl.File)
		} else {
			p.Warn("no per-file screenshot directories under %s", visualRoot)
		}
		return int(helpers.ExitRuntime)
	}
	for _, stem := range eligible {
		n, err := domain.AcceptBaselines(project.Path, stem)
		if err != nil {
			p.Error("%s: %v", stem, err)
			continue
		}
		p.Success("%s: accepted %d baseline(s)", stem, n)
	}
	return int(helpers.ExitSuccess)
}
