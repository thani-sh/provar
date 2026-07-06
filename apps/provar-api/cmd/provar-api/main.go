// Command provar-api is the WebSocket service that bridges GUI clients to
// the Provar SDK. See docs/adrs/004-provar-api-as-a-websocket-service.md
// for the protocol and design rationale.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	api "github.com/thani-sh/provar/apps/provar-api"
	// Blank import wires up handler registration via init(). Without this the
	// dispatch table is empty and every event is "unknown type".
	_ "github.com/thani-sh/provar/apps/provar-api/handlers"
	"github.com/thani-sh/provar/libs/logger"
)

const (
	defaultAddr = "127.0.0.1"
	defaultPort = 7741
)

func main() {
	var (
		addr = flag.String("addr", defaultAddr, "bind address (localhost only)")
		port = flag.Int("port", defaultPort, "listen port")
	)
	flag.Parse()

	srv, err := api.NewServer()
	if err != nil {
		logger.Error("init server", "err", err)
		os.Exit(1)
	}

	httpSrv := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", *addr, *port),
		Handler: http.HandlerFunc(srv.Handler),
		// Generous timeouts — compile and run jobs can take minutes. The
		// websocket library keeps the connection alive across long streams;
		// this just bounds how long the http.Server waits for graceful
		// shutdown once we stop accepting new connections.
		ReadHeaderTimeout: 10 * time.Second,
	}

	logger.Info("listening", "addr", httpSrv.Addr)

	errCh := make(chan error, 1)
	go func() {
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		if err != nil {
			logger.Error("listen", "err", err)
			os.Exit(1)
		}
	case sig := <-sigCh:
		logger.Info("shutting down", "signal", sig.String())
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		logger.Warn("shutdown", "err", err)
	}
}
