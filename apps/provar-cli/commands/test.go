package commands

import (
	"context"
	"os"
	"path/filepath"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
)

// testCmd is the "do the obvious thing" command: compile, then run. Same
// flags as run so users don't have to learn a second surface. Always
// recompiles before running — stale .test.lua should never silently ship
// to CI just because the .test.yml timestamp is older.
var testCmd = helpers.Command{
	Name:        "test",
	Summary:     "Compile and run the project in one shot",
	Flags:       runFlagBinding,
	NeedsTarget: true,
	Run:         testHandler,
}

func testHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	rf := raw.(*runFlags)
	p.Info("compiling %s", project.Path)
	compileRaw := &compileFlags{
		Headless: rf.Headless,
		UpTo:     rf.UpTo,
		Test:     rf.Test,
		Verbose:  rf.Verbose,
	}
	if rc := runCompile(ctx, target, compileRaw, p); rc != int(helpers.ExitSuccess) {
		return rc
	}
	files, err := selectFiles(project, raw.(*runFlags).Test)
	if err != nil {
		p.Error("%v", err)
		return int(helpers.ExitUsage)
	}
	missing := 0
	for _, f := range files {
		luaPath := filepath.Join(project.Path, trimYml(f.Path)+".test.lua")
		if _, err := os.Stat(luaPath); err != nil {
			p.Error("compile did not produce %s", luaPath)
			missing++
		}
	}
	if missing > 0 {
		return int(helpers.ExitRuntime)
	}
	p.Info("running %s", project.Path)
	return runHandler(ctx, target, raw, p)
}

// trimYml strips the .test.yml suffix from a file path so callers can append
// .test.lua without doubling extensions. Mirrors the trim in runHandler.
func trimYml(p string) string {
	if len(p) >= len(".test.yml") && p[len(p)-len(".test.yml"):] == ".test.yml" {
		return p[:len(p)-len(".test.yml")]
	}
	return p
}
