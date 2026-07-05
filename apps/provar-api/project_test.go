package main

import (
	"context"
	"path/filepath"
	"testing"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
)

// initSampleProject creates a sample project at t.TempDir()/provar-sample
// and returns its absolute path. The bundled sample is the same one
// `provar setup --sample` writes — login flow against demo.thani.sh.
func initSampleProject(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "provar-sample")
	if err := domain.InitProject(dir, true, false); err != nil {
		t.Fatalf("InitProject: %v", err)
	}
	return dir
}

func TestProjectOpenReturnsLoadedProject(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	resp, err := client.Open(context.Background(), &provarv1.OpenRequest{Path: dir})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if resp.GetPath() == "" {
		t.Error("Open returned empty path")
	}
	if len(resp.GetFiles()) == 0 {
		t.Error("Open returned no files")
	}
	if resp.GetBrowser() == nil {
		t.Error("Open returned nil browser config")
	}
}

func TestProjectOpenMissingPathReturnsInvalidArgument(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	_, err := client.Open(context.Background(), &provarv1.OpenRequest{})
	if err == nil {
		t.Fatal("Open with empty path succeeded; want error")
	}
	if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestProjectOpenNonExistentReturnsNotFound(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	_, err := client.Open(context.Background(), &provarv1.OpenRequest{Path: "/nonexistent/path/that/does/not/exist"})
	if err == nil {
		t.Fatal("Open of missing path succeeded; want error")
	}
	if got, want := statusCode(err), "NotFound"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestProjectInitScaffoldsNewProject(t *testing.T) {
	target := filepath.Join(t.TempDir(), "new-project")
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	resp, err := client.Init(context.Background(), &provarv1.InitRequest{Target: target, UseSample: true})
	if err != nil {
		t.Fatalf("Init: %v", err)
	}
	if resp.GetPath() != target {
		t.Errorf("Init returned path %q, want %q", resp.GetPath(), target)
	}
	if len(resp.GetFiles()) == 0 {
		t.Error("Init with sample returned no files")
	}
}

func TestProjectInitExistingWithoutForceReturnsAlreadyExists(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	_, err := client.Init(context.Background(), &provarv1.InitRequest{Target: dir, UseSample: true})
	if err == nil {
		t.Fatal("Init on existing dir succeeded; want error")
	}
	if got, want := statusCode(err), "AlreadyExists"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}

func TestProjectInitExistingWithForceSucceeds(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	_, err := client.Init(context.Background(), &provarv1.InitRequest{Target: dir, UseSample: true, Force: true})
	if err != nil {
		t.Fatalf("Init with force: %v", err)
	}
}

func TestProjectListReturnsFilesOnly(t *testing.T) {
	dir := initSampleProject(t)
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	resp, err := client.List(context.Background(), &provarv1.ListRequest{Path: dir})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if resp.GetPath() != dir {
		t.Errorf("List returned path %q, want %q", resp.GetPath(), dir)
	}
	if len(resp.GetFiles()) == 0 {
		t.Error("List returned no files")
	}
}

func TestProjectListMissingPathReturnsInvalidArgument(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewProjectServiceClient(conn)
	_, err := client.List(context.Background(), &provarv1.ListRequest{})
	if err == nil {
		t.Fatal("List with empty path succeeded; want error")
	}
	if got, want := statusCode(err), "InvalidArgument"; got != want {
		t.Errorf("status = %s, want %s", got, want)
	}
}
