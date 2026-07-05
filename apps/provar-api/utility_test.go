package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

func TestDoctorReturnsChecks(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	resp, err := client.Doctor(context.Background(), &provarv1.DoctorRequest{})
	if err != nil {
		t.Fatalf("Doctor: %v", err)
	}
	if len(resp.GetChecks()) == 0 {
		t.Fatal("Doctor returned no checks")
	}
	// On a clean dev machine, all checks should pass. If this ever
	// flakes, switch to checking individual checks rather than the
	// all_passed flag — the test's value is in the wire shape, not
	// the host environment.
	for _, c := range resp.GetChecks() {
		if c.GetName() == "" {
			t.Error("check with empty name")
		}
	}
}

func TestDoctorChecksProjectPath(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	dir := initSampleProject(t)
	resp, err := client.Doctor(context.Background(), &provarv1.DoctorRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Doctor: %v", err)
	}
	found := false
	for _, c := range resp.GetChecks() {
		if filepath.Base(dir) != "" && strings.Contains(c.GetName(), filepath.Base(dir)) {
			found = true
			if !c.GetPassed() {
				t.Errorf("project check should pass for sample project; got error %q", c.GetError())
			}
		}
	}
	if !found {
		t.Error("project check missing from Doctor response")
	}
}

func TestCleanRequiresProjectPath(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	_, err := client.Clean(context.Background(), &provarv1.CleanRequest{})
	if err == nil {
		t.Error("Clean with empty project_path succeeded; want InvalidArgument")
	} else if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestCleanRemovesCurrentScreenshotsByDefault(t *testing.T) {
	dir := initSampleProject(t)
	visualDir := filepath.Join(dir, apiVisualDir)
	if err := os.MkdirAll(visualDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(visualDir, "x.png"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	resp, err := client.Clean(context.Background(), &provarv1.CleanRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	if !actionRemoved(t, resp, "current screenshots") {
		t.Error("current screenshots action missing or not removed")
	}
	if _, err := os.Stat(visualDir); !os.IsNotExist(err) {
		t.Errorf("visual dir still exists: %v", err)
	}
}

func TestCleanKeepsBaselinesByDefault(t *testing.T) {
	dir := initSampleProject(t)
	baselineDir := filepath.Join(dir, apiBaselinesDir)
	if err := os.MkdirAll(baselineDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(baselineDir, "b.png"), []byte("b"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	resp, err := client.Clean(context.Background(), &provarv1.CleanRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	if actionPresent(t, resp, "baselines") {
		t.Error("baselines action should not be in default clean")
	}
	if _, err := os.Stat(baselineDir); err != nil {
		t.Errorf("baseline dir was removed without flag: %v", err)
	}
}

func TestCleanIncludeBaselinesRemoves(t *testing.T) {
	dir := initSampleProject(t)
	baselineDir := filepath.Join(dir, apiBaselinesDir)
	if err := os.MkdirAll(baselineDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	resp, err := client.Clean(context.Background(), &provarv1.CleanRequest{
		ProjectPath:      dir,
		IncludeBaselines: true,
	})
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	if !actionRemoved(t, resp, "baselines") {
		t.Error("baselines should be removed with IncludeBaselines")
	}
}

func TestCleanIncludeLuaRemovesCompiledFiles(t *testing.T) {
	dir := initSampleProject(t)
	luaPath := filepath.Join(dir, ".provar/tests/login.test.lua")
	if err := os.WriteFile(luaPath, []byte("-- lua"), 0o644); err != nil {
		t.Fatalf("write lua: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	resp, err := client.Clean(context.Background(), &provarv1.CleanRequest{
		ProjectPath: dir,
		IncludeLua:  true,
	})
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	found := false
	for _, a := range resp.GetActions() {
		if a.GetLabel() == "compiled login.test.lua" && a.GetRemoved() {
			found = true
		}
	}
	if !found {
		t.Error("compiled login.test.lua should be removed with IncludeLua")
	}
	if _, err := os.Stat(luaPath); !os.IsNotExist(err) {
		t.Errorf("lua file still exists: %v", err)
	}
}

func TestCleanDryRunReportsButDoesNotRemove(t *testing.T) {
	dir := initSampleProject(t)
	visualDir := filepath.Join(dir, apiVisualDir)
	if err := os.MkdirAll(visualDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewUtilityServiceClient(conn)
	resp, err := client.Clean(context.Background(), &provarv1.CleanRequest{ProjectPath: dir, DryRun: true})
	if err != nil {
		t.Fatalf("Clean: %v", err)
	}
	for _, a := range resp.GetActions() {
		if a.GetRemoved() {
			t.Errorf("dry-run clean removed %s", a.GetLabel())
		}
	}
	if _, err := os.Stat(visualDir); err != nil {
		t.Errorf("dry run removed visual dir: %v", err)
	}
}

// actionRemoved reports whether the report contains an action with the
// given label that was actually removed.
func actionRemoved(t *testing.T, resp *provarv1.CleanReport, label string) bool {
	t.Helper()
	for _, a := range resp.GetActions() {
		if a.GetLabel() == label && a.GetRemoved() {
			return true
		}
	}
	return false
}

func actionPresent(t *testing.T, resp *provarv1.CleanReport, label string) bool {
	t.Helper()
	for _, a := range resp.GetActions() {
		if a.GetLabel() == label {
			return true
		}
	}
	return false
}
