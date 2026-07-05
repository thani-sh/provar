package commands

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
	"github.com/thani-sh/provar/libs/models"
)

// compileFlags mirror runFlags so the `test` command can pass the same
// parsed flags through to both phases. Extra fields (--format, --from,
// --test, --verbose) are accepted but ignored during compile; only
// --headless and --up-to are honoured here.
type compileFlags struct {
	Headless bool   `flag:"headless" validate:"-"`
	UpTo     string `flag:"up-to" validate:"omitempty,regexp=^[A-Za-z0-9_-]+$"`
	Test     string `flag:"test" validate:"-"`
	Verbose  bool   `flag:"verbose" validate:"-"`
}

// Validate runs struct-tag rules on the flags struct.
func (f *compileFlags) Validate() error { return helpers.ValidateStruct(f) }

var compileFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{
		{Name: "headless", HasValue: true},
		{Name: "up-to", HasValue: true},
		{Name: "test", HasValue: true},
		{Name: "verbose"},
	},
	New: func() helpers.Flags { return &compileFlags{} },
}

var compileCmd = helpers.Command{
	Name:        "compile",
	Summary:     "Compile scenario files into Lua",
	Flags:       compileFlagBinding,
	NeedsTarget: true,
	Run:         runCompile,
}

// runCompile implements `provar compile <target> [--headless <bool>] [--up-to <action-id>] [--test <pattern>] [--verbose]`.
// Honors --headless, --up-to, and --test. --verbose is accepted (mirrors run)
// but no-op here — compile already streams debug logs.
func runCompile(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	fl := raw.(*compileFlags)
	if fl.Verbose {
		_ = os.Setenv("LOG_LEVEL", "debug")
	}
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	if len(project.Files) == 0 {
		p.Warn("no test files in %s", target)
		return int(helpers.ExitSuccess)
	}
	files, err := selectFiles(project, fl.Test)
	if err != nil {
		p.Error("%v", err)
		return int(helpers.ExitUsage)
	}
	settings, err := domain.LoadSettings()
	if err != nil {
		p.Error("settings: %v", err)
		return int(helpers.ExitRuntime)
	}
	if err := settings.Validate(); err != nil {
		p.Error("%v", err)
		return int(helpers.ExitRuntime)
	}
	active, ok := settings.Providers[string(settings.Provider)]
	if !ok {
		p.Error("active provider %q has no configuration entry", settings.Provider)
		return int(helpers.ExitRuntime)
	}
	client, err := models.NewClient(
		mapDomainProvider(settings.Provider),
		active.APIKey,
		active.BaseURL,
		active.Model,
	)
	if err != nil {
		p.Error("client: %v", err)
		return int(helpers.ExitRuntime)
	}
	w, h := project.Browser.Resolved()
	browserSession, err := browser.NewSession(ctx, browser.Options{
		Headless: fl.Headless,
		Width:    w,
		Height:   h,
	})
	if err != nil {
		p.Error("launch browser: %v", err)
		return int(helpers.ExitRuntime)
	}
	defer func() { _ = browserSession.Close() }()
	compiler := engine.NewCompiler(client)
	failed := 0
	for _, file := range files {
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
		result, err := compiler.Compile(ctx, actions, engine.CompileOptions{SpecPath: file.Path, Vars: project.Vars, Browser: browserSession})
		if err != nil {
			p.Error("compile %s: %v", file.Path, err)
			failed++
			continue
		}
		outPath := strings.TrimSuffix(file.Path, ".test.yml") + ".test.lua"
		if err := os.WriteFile(filepath.Join(project.Path, outPath), []byte(result.LuaCode), 0o644); err != nil {
			p.Error("write %s: %v", outPath, err)
			failed++
			continue
		}
		logger.Debug("compiled file", "path", outPath, "bytes", len(result.LuaCode))
		p.Success("compiled %s", outPath)
	}
	if failed > 0 {
		return int(helpers.ExitRuntime)
	}
	return int(helpers.ExitSuccess)
}

// mapDomainProvider bridges the settings-layer provider identifier to the SDK's models
// provider. The two packages use distinct types but share the same string values today.
func mapDomainProvider(p domain.Provider) models.Provider {
	switch p {
	case domain.ProviderGoogle:
		return models.Google
	case domain.ProviderOpenAI:
		return models.OpenAI
	case domain.ProviderAnthropic:
		return models.Anthropic
	}
	return ""
}

// truncateUpTo returns the prefix of actions ending with and including the
// action whose ID equals target. The bool reports whether the target was
// found. Used by compile and run to honour --up-to.
func truncateUpTo(actions []domain.Action, target string) ([]domain.Action, bool) {
	for i, a := range actions {
		if a.ID == target {
			return actions[:i+1], true
		}
	}
	return nil, false
}
