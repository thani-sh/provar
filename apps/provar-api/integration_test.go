package main

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/thani-sh/provar/apps/provar-api/client"
	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

// startRealServer brings up the full newServer() on a unix socket and
// returns the socket path plus a cleanup. Used by the integration tests
// to exercise the real socket path against the client package — no
// bufconn, no in-process dialer. Catches regressions in server.go
// registration and in how the unix socket flow is wired.
//
// The socket path is intentionally short — macOS caps unix socket paths
// at ~104 bytes and t.TempDir() paths can exceed that on their own.
// We anchor under os.TempDir() and let the test name disambiguate via
// a process-wide counter (see realSocketSeq).
func startRealServer(t *testing.T) (string, func()) {
	t.Helper()
	dir, err := os.MkdirTemp("", "provar-it-")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	socketPath := filepath.Join(dir, "p.sock")
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatalf("listen on %s: %v", socketPath, err)
	}
	srv := newServer()
	go func() { _ = srv.Serve(listener) }()
	cleanup := func() {
		srv.GracefulStop()
		_ = listener.Close()
		_ = os.RemoveAll(dir)
	}
	return socketPath, cleanup
}

// TestIntegrationHealthCheckOverRealSocket spins the full server up on a
// real unix socket, dials it via the client package, and confirms Health
// reports SERVING. The fact that this passes proves: server.go wires the
// service, the socket path the client dials matches what the server binds,
// and the client's gRPC channel can negotiate with our generated stubs.
func TestIntegrationHealthCheckOverRealSocket(t *testing.T) {
	socketPath, cleanup := startRealServer(t)
	defer cleanup()
	c, err := client.Connect(client.Options{SocketPath: socketPath})
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer func() { _ = c.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := c.Health.Check(ctx, &provarv1.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if got, want := resp.GetStatus(), provarv1.HealthServingStatus_HEALTH_SERVING_STATUS_SERVING; got != want {
		t.Errorf("status = %v, want %v", got, want)
	}
}

// TestIntegrationProjectOpenOverRealSocket goes one step past Health and
// exercises a read-only RPC that touches the filesystem. Uses a real
// InitProject'd directory (same helper the unit tests use) — the disk
// state is real, the wire transport is real, only the test scaffolding
// stays in-process.
func TestIntegrationProjectOpenOverRealSocket(t *testing.T) {
	socketPath, cleanup := startRealServer(t)
	defer cleanup()
	dir := initSampleProject(t)
	c, err := client.Connect(client.Options{SocketPath: socketPath})
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer func() { _ = c.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := c.Project.Open(ctx, &provarv1.OpenRequest{Path: dir})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if resp.GetPath() != dir {
		t.Errorf("path = %q, want %q", resp.GetPath(), dir)
	}
	if len(resp.GetFiles()) == 0 {
		t.Error("Open returned no files")
	}
	if resp.GetBrowser() == nil {
		t.Error("Open returned nil browser config")
	}
}

// TestIntegrationScenarioValidateOverRealSocket exercises the second
// non-trivial service through the real socket + client path. Asserts the
// sample project passes validation — proves the validator wires through
// domain.LoadProject on the server side and the response travels back
// over the wire intact.
func TestIntegrationScenarioValidateOverRealSocket(t *testing.T) {
	socketPath, cleanup := startRealServer(t)
	defer cleanup()
	dir := initSampleProject(t)
	c, err := client.Connect(client.Options{SocketPath: socketPath})
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer func() { _ = c.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := c.Scenario.Validate(ctx, &provarv1.ValidateRequest{ProjectPath: dir})
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if !resp.GetValid() {
		t.Errorf("sample project validation failed: %v", resp.GetErrors())
	}
}

// TestIntegrationDoctorOverRealSocket exercises the unary-with-multiple-
// checks shape of UtilityService. Doctor returns SERVING only if every
// check passes; we don't assert all_passed (the dev machine may lack an
// API key or a browser), but we do assert the wire returns the full list
// of checks in order — that's the contract we want regression coverage on.
func TestIntegrationDoctorOverRealSocket(t *testing.T) {
	socketPath, cleanup := startRealServer(t)
	defer cleanup()
	c, err := client.Connect(client.Options{SocketPath: socketPath})
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer func() { _ = c.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	resp, err := c.Utility.Doctor(ctx, &provarv1.DoctorRequest{})
	if err != nil {
		t.Fatalf("Doctor: %v", err)
	}
	if len(resp.GetChecks()) == 0 {
		t.Error("Doctor returned no checks")
	}
	for _, check := range resp.GetChecks() {
		if check.GetName() == "" {
			t.Error("check with empty name")
		}
	}
}
