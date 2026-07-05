package commands

import (
	"context"
	"fmt"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
)

// listCmd enumerates the test scenarios in a project. Useful when picking a
// value for --up-to, --from, or --test without having to read the .yml files.
var listCmd = helpers.Command{
	Name:        "list",
	Summary:     "Enumerate test scenarios in the project",
	Flags:       helpers.FlagBinding{},
	NeedsTarget: true,
	Run:         listHandler,
}

func listHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = ctx
	_ = raw
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	if len(project.Files) == 0 {
		p.Warn("no test files in %s", target)
		return int(helpers.ExitSuccess)
	}
	fmt.Fprintln(p.Out, helpers.FormatBold("Test scenarios"))
	for _, f := range project.Files {
		fmt.Fprintf(p.Out, "  %s\n", helpers.FormatBold(f.Path))
		actions, err := domain.ParseFile(project.Path, f.Path)
		if err != nil {
			p.Warn("    (parse error: %v)", err)
			continue
		}
		for _, a := range actions {
			fmt.Fprintf(p.Out, "    %s  %s — %s\n", a.ID, a.Name, a.Info)
		}
	}
	return int(helpers.ExitSuccess)
}
