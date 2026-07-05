package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"google.golang.org/grpc/status"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

// statusCode extracts the gRPC status code name from an error. Returns
// "OK" for nil errors so callers can compare without a nil check.
func statusCode(err error) string {
	if err == nil {
		return "OK"
	}
	if st, ok := status.FromError(err); ok {
		return st.Code().String()
	}
	return "Unknown"
}

func TestScenarioGetReturnsParsedActions(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewScenarioServiceClient(conn)
	resp, err := client.Get(context.Background(), &provarv1.GetRequest{
		ProjectPath: dir,
		FilePath:    ".provar/tests/login.test.yml",
	})
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(resp.GetActions()) == 0 {
		t.Fatal("Get returned no actions")
	}
	for _, a := range resp.GetActions() {
		if a.GetId() == "" {
			t.Error("action with empty id in response")
		}
	}
}

func TestScenarioGetMissingProjectPathReturnsInvalidArgument(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewScenarioServiceClient(conn)
	_, err := client.Get(context.Background(), &provarv1.GetRequest{FilePath: ".provar/tests/login.test.yml"})
	if err == nil {
		t.Fatal("Get with empty project_path succeeded; want error")
	}
	if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestScenarioValidateCleanProject(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewScenarioServiceClient(conn)
	resp, err := client.Validate(context.Background(), &provarv1.ValidateRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if !resp.GetValid() {
		t.Errorf("sample project validation failed: %v", resp.GetErrors())
	}
}

func TestScenarioValidateReportsDuplicateIDs(t *testing.T) {
	dir := initSampleProject(t)
	// Append a second file with a duplicate id so cross-file dup detection fires.
	dup := "- id: open_login_page\n  name: Duplicate\n  info: Will collide with the sample\n"
	dupPath := ".provar/tests/dup.test.yml"
	if err := writeTestFile(filepath.Join(dir, dupPath), dup); err != nil {
		t.Fatalf("write dup file: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewScenarioServiceClient(conn)
	resp, err := client.Validate(context.Background(), &provarv1.ValidateRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if resp.GetValid() {
		t.Error("Validate reported valid for project with duplicate IDs")
	}
	found := false
	for _, e := range resp.GetErrors() {
		if strings.Contains(e.GetMessage(), "duplicate action id") {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected duplicate-id error in response, got: %v", resp.GetErrors())
	}
}

func TestScenarioValidateReportsMissingName(t *testing.T) {
	dir := initSampleProject(t)
	noName := "- id: lonely_action\n  info: no name\n"
	if err := writeTestFile(filepath.Join(dir, ".provar/tests/noname.test.yml"), noName); err != nil {
		t.Fatalf("write file: %v", err)
	}
	_, conn := startTestServer(t)
	client := provarv1.NewScenarioServiceClient(conn)
	resp, err := client.Validate(context.Background(), &provarv1.ValidateRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if resp.GetValid() {
		t.Error("Validate reported valid for action with missing name")
	}
}

// writeTestFile writes data to path, creating parent directories. Tests
// use this to add extra .test.yml files to a sample project without
// repeating os.MkdirAll + os.WriteFile boilerplate.
func writeTestFile(path, data string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(data), 0o644)
}
