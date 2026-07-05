package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
)

// utilityServer implements UtilityService. Both RPCs are unary — Doctor
// reports a list of checks, Clean returns what was (or would be) removed.
type utilityServer struct {
	provarv1.UnimplementedUtilityServiceServer
}

// Doctor runs the same pre-flight checks the CLI's `provar doctor` does:
// settings parse, settings validate, optional project path, and a
// browser launch. Returns the full check list — clients render them.
func (s *utilityServer) Doctor(ctx context.Context, req *provarv1.DoctorRequest) (*provarv1.DoctorReport, error) {
	report := &provarv1.DoctorReport{}
	settings, err := domain.LoadSettings()
	report.Checks = append(report.Checks, doctorCheck("settings file (~/.provar/settings.yml) parses", err))
	if err == nil {
		report.Checks = append(report.Checks, doctorCheck("settings validate", settings.Validate()))
	}
	if req.GetProjectPath() != "" {
		_, statErr := os.Stat(req.GetProjectPath())
		report.Checks = append(report.Checks, doctorCheck(fmt.Sprintf("project %q exists", req.GetProjectPath()), statErr))
	}
	// Browser launch is the slowest check — keep it last so failures
	// from earlier checks surface first.
	sess, err := browser.NewSession(ctx, browser.Options{Headless: true})
	browserCheck := doctorCheck("browser launches (headless)", err)
	if err == nil {
		_ = sess.Close()
	}
	report.Checks = append(report.Checks, browserCheck)
	for _, c := range report.Checks {
		if !c.GetPassed() {
			report.AllPassed = false
			return report, nil
		}
	}
	report.AllPassed = true
	return report, nil
}

// doctorCheck wraps a check result. Empty error means success; non-empty
// means failure with that error message. Keeps the DoctorReport construction
// one line per check at the call site.
func doctorCheck(name string, err error) *provarv1.DoctorCheck {
	if err != nil {
		return &provarv1.DoctorCheck{Name: name, Passed: false, Error: err.Error()}
	}
	return &provarv1.DoctorCheck{Name: name, Passed: true}
}

// Clean removes generated artifacts from the project. The default removal
// set is just current-run screenshots; baselines and compiled Lua stay
// unless their flags are set. dry_run=true reports what would be removed
// without touching the filesystem.
func (s *utilityServer) Clean(_ context.Context, req *provarv1.CleanRequest) (*provarv1.CleanReport, error) {
	if req.GetProjectPath() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_path is required")
	}
	project, err := domain.LoadProject(req.GetProjectPath())
	if err != nil {
		return nil, mapLoadError(err)
	}
	report := &provarv1.CleanReport{}
	targets := []struct {
		path   string
		label  string
		always bool
	}{
		{path: filepath.Join(project.Path, apiVisualDir), label: "current screenshots", always: true},
		{path: filepath.Join(project.Path, apiBaselinesDir), label: "baselines", always: false},
	}
	for _, t := range targets {
		if !t.always && !req.GetIncludeBaselines() {
			continue
		}
		action := cleanOne(t.path, t.label, req.GetDryRun())
		report.Actions = append(report.Actions, action)
	}
	if req.GetIncludeLua() {
		for _, f := range project.Files {
			luaPath := filepath.Join(project.Path, strings.TrimSuffix(f.Path, ".test.yml")+".test.lua")
			action := cleanOne(luaPath, "compiled "+filepath.Base(luaPath), req.GetDryRun())
			report.Actions = append(report.Actions, action)
		}
	}
	return report, nil
}

// cleanOne removes (or pretends to remove) a single path and reports the
// outcome. Missing paths are not errors — they're an "already clean" state.
func cleanOne(path, label string, dryRun bool) *provarv1.CleanAction {
	action := &provarv1.CleanAction{Label: label, Path: path}
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			action.Error = "not found"
			return action
		}
		action.Error = err.Error()
		return action
	}
	if dryRun {
		action.Removed = false
		action.Error = "dry run"
		return action
	}
	if err := os.RemoveAll(path); err != nil {
		action.Error = err.Error()
		return action
	}
	action.Removed = true
	return action
}
