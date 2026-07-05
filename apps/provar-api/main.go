// Command provar-api is the Provar gRPC server. It owns the engine and exposes
// it to in-process clients (the graphical editor, internal tools) over a
// unix socket by default, with TCP as opt-in for remote work.
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
)

// defaultSocketPath is the unix socket the server binds to when --listen is
// unset. Lives in the OS temp directory so it disappears on reboot but
// persists across process restarts.
const defaultSocketPath = "/tmp/provar.sock"

// socketMode is the file permission applied to the unix socket. 0o660 makes
// the socket readable/writable by the owning user and group, but not by
// others — matching the trust boundary of the local CLI.
const socketMode = 0o660

func main() {
	socket := flag.String("socket", defaultSocketPath, "unix socket path to listen on (default)")
	listen := flag.String("listen", "", "optional TCP listen address (e.g. :50051); mutually exclusive with --socket")
	flag.Parse()
	if *socket != defaultSocketPath && *listen != "" {
		log.Fatal("--socket and --listen are mutually exclusive")
	}
	if *listen != "" {
		runTCP(*listen)
		return
	}
	runSocket(*socket)
}

// runSocket binds a gRPC server to a unix socket. Stale socket files are
// removed before listen so a crashed previous instance doesn't block startup.
func runSocket(path string) {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Fatalf("clear stale socket %s: %v", path, err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Fatalf("prepare socket dir: %v", err)
	}
	listener, err := net.Listen("unix", path)
	if err != nil {
		log.Fatalf("listen on %s: %v", path, err)
	}
	defer func() { _ = os.Remove(path) }()
	if err := os.Chmod(path, socketMode); err != nil {
		log.Fatalf("chmod socket %s: %v", path, err)
	}
	serve(listener, "unix", path)
}

// runTCP binds a gRPC server to a TCP address.
func runTCP(addr string) {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("listen on %s: %v", addr, err)
	}
	serve(listener, "tcp", addr)
}

// serve brings up the gRPC server with signal-driven graceful shutdown.
// addr is only used for log output.
func serve(listener net.Listener, network, addr string) {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	srv := newServer()
	log.Printf("provar-api: listening on %s://%s", network, addr)
	errCh := make(chan error, 1)
	go func() { errCh <- srv.Serve(listener) }()
	select {
	case err := <-errCh:
		if err != nil {
			log.Fatalf("serve: %v", err)
		}
	case <-ctx.Done():
		log.Printf("provar-api: shutting down")
		stopped := make(chan struct{})
		go func() { srv.GracefulStop(); close(stopped) }()
		select {
		case <-stopped:
		case <-ctx.Done():
			srv.Stop()
		}
	}
}
