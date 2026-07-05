package commands

import (
	"context"
	"fmt"
	"os"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
)

// doctorCmd runs a small set of pre-flight checks: settings file parses,
// the active provider has an API key, and a browser can launch. Anything
// else (model reachability, network, etc.) belongs behind explicit flags
// so doctor stays fast and offline-friendly.
var doctorCmd = helpers.Command{
	Name:        "doctor",
	Summary:     "Diagnose common setup problems",
	Flags:       helpers.FlagBinding{},
	NeedsTarget: false,
	Run:         doctorHandler,
}

func doctorHandler(ctx context.Context, target string, raw helpers.Flags, p *helpers.Printer) int {
	_ = target
	_ = raw
	fmt.Fprintln(p.Out, helpers.FormatBold("provar doctor"))
	checks := 0
	failed := 0
	check := func(name string, err error) {
		checks++
		if err != nil {
			p.Error("  ✗ %s: %v", name, err)
			failed++
			return
		}
		p.Success("  ✓ %s", name)
	}
	// Settings file exists and parses.
	settings, err := domain.LoadSettings()
	check("settings file (~/.provar/settings.yml) parses", err)
	if err == nil {
		// Settings validate (provider choice, api key present).
		check("settings validate", settings.Validate())
		// Configurable project path is optional; if the user passed one, check it.
		if target != "" {
			if _, statErr := os.Stat(target); statErr != nil {
				check(fmt.Sprintf("project %q exists", target), statErr)
			} else {
				check(fmt.Sprintf("project %q exists", target), nil)
			}
		}
	}
	// Browser can launch headless. This is the slowest check (3-5s on a
	// cold start), so it's last. Failure here usually means rod/Chromium
	// can't find a sandbox or system deps are missing.
	sess, err := browser.NewSession(ctx, browser.Options{Headless: true})
	if err != nil {
		check("browser launches (headless)", err)
	} else {
		check("browser launches (headless)", nil)
		_ = sess.Close()
	}
	if failed > 0 {
		p.Error("%d of %d check(s) failed", failed, checks)
		return int(helpers.ExitRuntime)
	}
	p.Success("all %d check(s) passed", checks)
	return int(helpers.ExitSuccess)
}
