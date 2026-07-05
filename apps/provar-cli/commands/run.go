package commands

import (
	"context"
	"encoding/base64"
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
	From     string `flag:"from" validate:"omitempty,regexp=^[A-Za-z0-9_-]+$"`
	Test     string `flag:"test" validate:"-"`
	Format   string `flag:"format" validate:"omitempty,oneof=text json junit"`
	Verbose  bool   `flag:"verbose" validate:"-"`
}

// Validate runs struct-tag rules on the flags struct.
func (f *runFlags) Validate() error { return helpers.ValidateStruct(f) }

var runFlagBinding = helpers.FlagBinding{
	Specs: []helpers.FlagSpec{
		{Name: "headless", HasValue: true},
		{Name: "up-to", HasValue: true},
		{Name: "from", HasValue: true},
		{Name: "test", HasValue: true},
		{Name: "format", HasValue: true, Alias: "f"},
		{Name: "verbose"},
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
	fl := raw.(*runFlags)
	if fl.Verbose {
		_ = os.Setenv("LOG_LEVEL", "debug")
	}
	headless := fl.Headless
	project, err := domain.LoadProject(target)
	if err != nil {
		p.Error("load project: %v", err)
		return int(helpers.ExitUsage)
	}
	runner := engine.NewRunner()
	files, err := selectFiles(project, fl.Test)
	if err != nil {
		p.Error("%v", err)
		return int(helpers.ExitUsage)
	}
	rend := newRenderer(fl.Format, p)
	fileStems := make([]string, 0, len(files))
	for _, f := range files {
		fileStems = append(fileStems, strings.TrimSuffix(filepath.Base(f.Path), ".test.yml"))
	}
	failed := 0
	for i, file := range files {
		fileStem := fileStems[i]
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
		if fl.From != "" {
			truncated, ok := truncateFrom(actions, fl.From)
			if !ok {
				p.Warn("skip %s: --from target %q not found", file.Path, fl.From)
				failed++
				continue
			}
			actions = truncated
		}
		job, err := runner.Run(ctx, actions, string(luaCode), engine.RunOptions{
			Headless: headless,
			Vars:     project.Vars,
			UpTo:     fl.UpTo,
			Browser:  project.Browser,
		})
		logger.Debug("ran file", "path", luaPath)
		if err != nil {
			p.Error("run %s: %v", file.Path, err)
			failed++
			continue
		}
		for ev := range job.Subscribe() {
			rend.OnEvent(ev, project.Path, fileStem)
		}
	}
	if err := rend.OnFinish(project.Path, fileStems); err != nil {
		p.Warn("renderer finish: %v", err)
	}
	if failed > 0 {
		return int(helpers.ExitRuntime)
	}
	return int(helpers.ExitSuccess)
}

// newRenderer picks the right renderer for the requested --format. Unknown
// formats fall back to text and surface a warning so the run still completes
// (we don't want a typo on the CLI to silently produce nothing).
func newRenderer(format string, p *helpers.Printer) runRenderer {
	switch format {
	case "json":
		return newJSONRenderer(p.Out)
	case "junit":
		return newJUnitRenderer(p.Out)
	case "text", "":
		return newTextRenderer(p.Out, p.Err)
	default:
		p.Warn("unknown --format %q, falling back to text", format)
		return newTextRenderer(p.Out, p.Err)
	}
}

// handleVisualEvent saves the screenshot for the step and reports the diff
// status against the baseline (if any). Diff is info-only — failing on
// visual regression belongs behind a future --strict-visual flag, so a
// missing or drifted baseline never breaks a run by surprise.
func handleVisualEvent(ev domain.Event, projectRoot, fileStem string, r textSink) {
	data, ok := ev.Data.(map[string]any)
	if !ok {
		return
	}
	taskID, _ := data["taskId"].(string)
	pngB64, _ := data["screenshotBase64"].(string)
	if taskID == "" || pngB64 == "" {
		return
	}
	png, err := saveScreenshot(projectRoot, fileStem, taskID, pngB64)
	if err != nil {
		r.warn("visual: %v", err)
		return
	}
	switch compareToBaseline(projectRoot, fileStem, taskID, mustDecode(pngB64)) {
	case visualFirstRun:
		r.info("  📷 %s (no baseline yet — run `provar accept-baseline %s` to set one)", taskID, fileStem)
	case visualMatch:
		r.success("  📷 %s (matches baseline)", taskID)
	case visualDiff:
		r.warn("  📷 %s (differs from baseline: %s)", taskID, formatVisualHash(mustDecode(pngB64)))
	}
	_ = png // path printed by the messages above; suppress unused-var noise
}

// textSink is the minimal printer interface handleVisualEvent needs. Both
// *helpers.Printer and *textRenderer satisfy it, so visual output works in
// every render mode without going through the JSON/JUnit paths (those
// renderers explicitly opt out of visual decoration — screenshots have no
// JUnit slot).
type textSink interface {
	info(format string, a ...any)
	warn(format string, a ...any)
	success(format string, a ...any)
}

// adaptPrinter wraps a *helpers.Printer into a textSink for visual output.
func adaptPrinter(p *helpers.Printer) textSink {
	return printerSink{p: p}
}

type printerSink struct{ p *helpers.Printer }

func (s printerSink) info(format string, a ...any)    { s.p.Info(format, a...) }
func (s printerSink) warn(format string, a ...any)    { s.p.Warn(format, a...) }
func (s printerSink) success(format string, a ...any) { s.p.Success(format, a...) }

// mustDecode decodes a base64 PNG or returns nil. Visual-event handling is
// best-effort; if the bytes are malformed the worst case is we skip the hash
// report, never a hard failure.
func mustDecode(b64 string) []byte {
	png, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil
	}
	return png
}
