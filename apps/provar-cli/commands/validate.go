package commands

import (
	"context"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
)

// validateCmd parses every .test.yml in the project and reports errors
// without paying for an LLM compile. Catches malformed YAML, missing
// required fields, and duplicate action IDs across files before the user
// discovers them via a failed compile.
var validateCmd = helpers.Command{
	Name:        "validate",
	Summary:     "Parse-check test scenarios without compiling",
	Flags:       helpers.FlagBinding{},
	NeedsTarget: true,
	Run:         validateHandler,
}

func validateHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
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
	// seenIDs tracks IDs across the whole project so duplicate IDs in
	// different files also fail validation — they'd silently collide at
	// run time if every file is compiled into one Lua.
	seenIDs := map[string]string{} // id → file it was first seen in
	var problems int
	for _, f := range project.Files {
		actions, err := domain.ParseFile(project.Path, f.Path)
		if err != nil {
			p.Error("%s: %v", f.Path, err)
			problems++
			continue
		}
		for _, a := range actions {
			if a.ID == "" {
				p.Error("%s: action with empty id: %s", f.Path, a.Name)
				problems++
				continue
			}
			if a.Name == "" {
				p.Error("%s: %s: missing name", f.Path, a.ID)
				problems++
			}
			if a.Info == "" {
				p.Warn("%s: %s: empty info (LLM will have to guess the intent)", f.Path, a.ID)
			}
			if other, dup := seenIDs[a.ID]; dup {
				p.Error("%s: duplicate action id %q (also in %s)", f.Path, a.ID, other)
				problems++
				continue
			}
			seenIDs[a.ID] = f.Path
		}
	}
	if problems > 0 {
		p.Error("validation failed: %d problem(s)", problems)
		return int(helpers.ExitRuntime)
	}
	p.Success("validated %d file(s), %d action(s)", len(project.Files), len(seenIDs))
	return int(helpers.ExitSuccess)
}
