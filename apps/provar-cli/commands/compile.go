package commands

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/models"
)

// compileFlags are the typed flags for the compile command.
type compileFlags struct {
	UpTo string `flag:"up-to" validate:"omitempty,alphanum"`
}

// Validate runs struct-tag rules on the flags struct.
func (f *compileFlags) Validate() error { return helpers.ValidateStruct(f) }

var compileFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{{Name: "up-to", HasValue: true}},
	New:   func() helpers.Flags { return &compileFlags{} },
}

var compileCmd = helpers.Command{
	Name:        "compile",
	Summary:     "Compile scenario files into Lua",
	Flags:       compileFlagBinding,
	NeedsTarget: true,
	Run:         runCompile,
}

// runCompile implements `provar compile <target> [--up-to <action-id>]`. Loads the
// project, validates settings, opens a model session, and asks the engine compiler to
// translate each file's actions into Lua. Per-file parse errors are warnings (continue),
// per-file compile errors are errors (continue and report at the end).
func runCompile(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = raw.(*compileFlags)
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	if len(project.Files) == 0 {
		p.Warn("no test files in %s", target)
		return int(helpers.ExitSuccess)
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
	active, ok := settings.Models.Providers[string(settings.Models.Provider)]
	if !ok {
		p.Error("active provider %q has no configuration entry", settings.Models.Provider)
		return int(helpers.ExitRuntime)
	}
	client, err := models.NewClient(
		mapDomainProvider(settings.Models.Provider),
		active.APIKey,
		active.BaseURL,
		active.Model,
	)
	if err != nil {
		p.Error("client: %v", err)
		return int(helpers.ExitRuntime)
	}
	session, err := client.CreateSession(ctx, "")
	if err != nil {
		p.Error("session: %v", err)
		return int(helpers.ExitRuntime)
	}
	compiler := engine.NewCompiler(session)
	failed := 0
	for _, file := range project.Files {
		actions, err := domain.ParseFile(project.Path, file.Path)
		if err != nil {
			p.Warn("skip %s: %v", file.Path, err)
			failed++
			continue
		}
		result, err := compiler.Compile(ctx, actions, engine.CompileOptions{SpecPath: file.Path})
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
