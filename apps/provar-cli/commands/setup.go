package commands

import (
	"context"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/sdk/domain"
)

// setupFlags are the typed flags for the setup command. The `flag:"..."` tag tells the
// helpers parser which CLI flag maps to which struct field.
type setupFlags struct {
	Sample bool `flag:"sample"`
	Force  bool `flag:"force"`
}

// Validate runs struct-tag rules on the flags struct.
func (f *setupFlags) Validate() error { return helpers.ValidateStruct(f) }

var setupFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{
		{Name: "sample"},
		{Name: "force"},
	},
	New: func() helpers.Flags { return &setupFlags{} },
}

var setupCmd = helpers.Command{
	Name:        "setup",
	Summary:     "Create a new provar project directory",
	Flags:       setupFlagBinding,
	NeedsTarget: true,
	Run:         runSetup,
}

// runSetup implements `provar setup <target> [--sample] [--force]`. Delegates the actual
// scaffolding to domain.InitProject — this handler is the CLI shell around it.
func runSetup(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = ctx
	fl := raw.(*setupFlags)
	if err := domain.InitProject(target, fl.Sample, fl.Force); err != nil {
		p.Error("%v", err)
		return int(helpers.ExitRuntime)
	}
	p.Success("created project at %s", target)
	return int(helpers.ExitSuccess)
}
