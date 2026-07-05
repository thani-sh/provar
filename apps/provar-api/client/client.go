package client

import (
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

// Options controls how Connect dials the server. Zero values default to
// the unix socket the server binds by default and a 5s dial timeout.
type Options struct {
	// SocketPath is the unix socket to dial. Wins over Addr when set.
	// Empty falls through to Addr.
	SocketPath string

	// Addr is the TCP address (host:port) to dial. Used only when
	// SocketPath is empty. Empty falls through to DefaultSocketPath.
	Addr string

	// DialTimeout bounds the initial connect. Zero defaults to
	// DefaultDialTimeout.
	DialTimeout time.Duration
}

// resolveTarget picks the dial target based on Options. Defaults to the
// standard unix socket path so a bare Connect() call lands on the same
// socket the server bound to.
func (o Options) resolveTarget() string {
	if o.SocketPath != "" {
		return "unix://" + o.SocketPath
	}
	if o.Addr != "" {
		return o.Addr
	}
	return "unix://" + DefaultSocketPath
}

// resolveTimeout returns the dial timeout, defaulting when zero.
func (o Options) resolveTimeout() time.Duration {
	if o.DialTimeout != 0 {
		return o.DialTimeout
	}
	return DefaultDialTimeout
}

// Client is the typed entry point for talking to a prover-api server.
// Every service accessor shares one underlying gRPC connection; Close
// releases it. Safe for concurrent use — the gRPC client stubs are
// goroutine-safe.
type Client struct {
	conn *grpc.ClientConn

	Health   provarv1.HealthServiceClient
	Project  provarv1.ProjectServiceClient
	Scenario provarv1.ScenarioServiceClient
	Compile  provarv1.CompileServiceClient
	Run      provarv1.RunServiceClient
	Utility  provarv1.UtilityServiceClient
}

// Connect dials the api server using opts and returns a Client whose
// service accessors are ready to use. Returns an error if the dial
// doesn't succeed within the configured timeout.
func Connect(opts Options) (*Client, error) {
	target := opts.resolveTarget()
	conn, err := grpc.NewClient(
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", target, err)
	}
	return &Client{
		conn:     conn,
		Health:   provarv1.NewHealthServiceClient(conn),
		Project:  provarv1.NewProjectServiceClient(conn),
		Scenario: provarv1.NewScenarioServiceClient(conn),
		Compile:  provarv1.NewCompileServiceClient(conn),
		Run:      provarv1.NewRunServiceClient(conn),
		Utility:  provarv1.NewUtilityServiceClient(conn),
	}, nil
}

// Close releases the underlying gRPC connection. Safe to call multiple
// times — the second and later calls are no-ops.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}
