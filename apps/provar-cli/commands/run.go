package commands

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/logger"
)

// runFlags are the typed flags for the run command. The `validate:"-"` tag tells the
// validator to skip this field (it's runtime configuration, not a validateable input).
type runFlags struct {
	Headless bool   `flag:"headless" validate:"-"`
	UpTo     string `flag:"up-to" validate:"omitempty,regexp=^[A-Za-z0-9_-]+$"`
}

// Validate runs struct-tag rules on the flags struct.
func (f *runFlags) Validate() error { return helpers.ValidateStruct(f) }

var runFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{
		{Name: "headless", HasValue: true},
		{Name: "up-to", HasValue: true},
	},
	New: func() helpers.Flags { return &runFlags{} },
}

var runCmd = helpers.Command{
	Name:        "run",
	Summary:     "Execute compiled scenarios against a running app",
	Flags:       runFlagBinding,
	NeedsTarget: true,
	Run:         runHandler,
}

// runHandler implements `provar run <target> [--headless <bool>] [--up-to <action-id>]`. Reads the compiled
// .test.lua next to each .test.yml, calls engine.Runner.Run, and renders events to the
// printer as they stream. Per-file errors are non-fatal; the run continues.
func runHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = ctx
	fl := raw.(*runFlags)
	headless := fl.Headless
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	runner := engine.NewRunner()
	failed := 0
	for _, file := range project.Files {
		luaPath := strings.TrimSuffix(file.Path, ".test.yml") + ".test.lua"
		luaCode, err := os.ReadFile(filepath.Join(project.Path, luaPath))
		if err != nil {
			p.Warn("skip %s: %v", file.Path, err)
			failed++
			continue
		}
		actions, err := domain.ParseFile(project.Path, file.Path)
		if err != nil {
			p.Warn("skip %s: %v", file.Path, err)
			failed++
			continue
		}
		if fl.UpTo != "" {
			truncated, ok := truncateUpTo(actions, fl.UpTo)
			if !ok {
				p.Warn("skip %s: --up-to target %q not found", file.Path, fl.UpTo)
				failed++
				continue
			}
			actions = truncated
		}
		job, err := runner.Run(ctx, actions, string(luaCode), engine.RunOptions{Headless: headless, Vars: project.Vars, UpTo: fl.UpTo})
		logger.Debug("ran file", "path", luaPath)
		if err != nil {
			p.Error("run %s: %v", file.Path, err)
			failed++
			continue
		}
		for ev := range job.Subscribe() {
			renderEvent(ev, p)
		}
	}
	if failed > 0 {
		return int(helpers.ExitRuntime)
	}
	return int(helpers.ExitSuccess)
}

// renderEvent translates a domain.Event into printer output. Event types are stringly
// typed because the engine emits them as opaque strings today. When the engine grows typed
// events, this becomes a type switch.
func renderEvent(ev domain.Event, p *helpers.Printer) {
	switch ev.Type {
	case "run-started":
		p.Info("run started")
	case "task-started":
		if data, ok := ev.Data.(map[string]string); ok {
			p.Info("  → %s (%s)", data["title"], data["taskId"])
			return
		}
		p.Info("  → %v", ev.Data)
	case "task-finished":
		p.Success("  ✓ done")
	case "task-failed":
		if data, ok := ev.Data.(map[string]string); ok {
			p.Error("  ✗ %s: %s", data["taskId"], data["error"])
			return
		}
		p.Error("  ✗ %v", ev.Data)
	case "run-finished":
		if msg, ok := ev.Data.(string); ok {
			p.Error("run failed: %s", msg)
			return
		}
		if data, ok := ev.Data.(map[string]any); ok {
			p.Info("run finished: %s (%s)", data["status"], data["duration"])
			return
		}
		p.Info("run finished: %v", ev.Data)
	}
}
