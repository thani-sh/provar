package client

import (
	"testing"
)

func TestOptionsResolveDefaultSocketPath(t *testing.T) {
	got := Options{}.resolveTarget()
	want := "unix://" + DefaultSocketPath
	if got != want {
		t.Errorf("resolveTarget() = %q, want %q", got, want)
	}
}

func TestOptionsResolveExplicitSocketPath(t *testing.T) {
	got := Options{SocketPath: "/tmp/custom.sock"}.resolveTarget()
	want := "unix:///tmp/custom.sock"
	if got != want {
		t.Errorf("resolveTarget() = %q, want %q", got, want)
	}
}

func TestOptionsResolveAddrOverridesDefault(t *testing.T) {
	got := Options{Addr: "localhost:50051"}.resolveTarget()
	want := "localhost:50051"
	if got != want {
		t.Errorf("resolveTarget() = %q, want %q", got, want)
	}
}

func TestOptionsResolveSocketPathWinsOverAddr(t *testing.T) {
	got := Options{SocketPath: "/tmp/x.sock", Addr: "localhost:50051"}.resolveTarget()
	want := "unix:///tmp/x.sock"
	if got != want {
		t.Errorf("resolveTarget() = %q, want %q", got, want)
	}
}

func TestOptionsResolveTimeoutDefault(t *testing.T) {
	got := Options{}.resolveTimeout()
	if got != DefaultDialTimeout {
		t.Errorf("resolveTimeout() = %v, want %v", got, DefaultDialTimeout)
	}
}

func TestOptionsResolveTimeoutExplicit(t *testing.T) {
	got := Options{DialTimeout: 123}.resolveTimeout()
	if got != 123 {
		t.Errorf("resolveTimeout() = %v, want 123", got)
	}
}

// TestConnectWiresAllServiceAccessors confirms Connect returns a Client
// with every service accessor populated. Uses a non-existent socket path
// — Connect is non-blocking and won't fail until an RPC is made.
func TestConnectWiresAllServiceAccessors(t *testing.T) {
	c, err := Connect(Options{SocketPath: "/tmp/does-not-exist-test.sock"})
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer func() { _ = c.Close() }()
	if c.Health == nil {
		t.Error("Health accessor is nil")
	}
	if c.Project == nil {
		t.Error("Project accessor is nil")
	}
	if c.Scenario == nil {
		t.Error("Scenario accessor is nil")
	}
	if c.Compile == nil {
		t.Error("Compile accessor is nil")
	}
	if c.Run == nil {
		t.Error("Run accessor is nil")
	}
	if c.Utility == nil {
		t.Error("Utility accessor is nil")
	}
}

// TestCloseIsIdempotent confirms Close can be called multiple times without
// erroring. Tests using Client in t.Cleanup and explicit defer both rely
// on this.
func TestCloseIsIdempotent(t *testing.T) {
	c := &Client{}
	if err := c.Close(); err != nil {
		t.Errorf("first Close: %v", err)
	}
	if err := c.Close(); err != nil {
		t.Errorf("second Close: %v", err)
	}
}
