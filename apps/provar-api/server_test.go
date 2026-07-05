package main

import (
	"context"
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
)

const bufconnSize = 1 << 20

// startTestServer brings up a *grpc.Server on an in-memory bufconn listener
// and returns the listener plus a ready client connection. Tests use this to
// exercise RPCs without binding a real port.
func startTestServer(t *testing.T) (*bufconn.Listener, *grpc.ClientConn) {
	t.Helper()
	lis := bufconn.Listen(bufconnSize)
	srv := newServer()
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(func() {
		srv.Stop()
		_ = lis.Close()
	})
	conn, err := grpc.NewClient(
		"passthrough://bufnet",
		grpc.WithContextDialer(func(_ context.Context, _ string) (net.Conn, error) {
			return lis.Dial()
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("dial bufconn: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return lis, conn
}

func TestHealthCheckReturnsServing(t *testing.T) {
	_, conn := startTestServer(t)
	client := provarv1.NewHealthServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := client.Check(ctx, &provarv1.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if got, want := resp.Status, provarv1.HealthServingStatus_HEALTH_SERVING_STATUS_SERVING; got != want {
		t.Errorf("status = %v, want %v", got, want)
	}
}
