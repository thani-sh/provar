package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/coder/websocket"

	"github.com/thani-sh/provar/libs/logger"
)

// Handler is the http.Handler that accepts WebSocket connections. Each
// connection gets its own goroutine that reads envelopes in a loop and
// dispatches them via the registry in dispatch.go.
//
// The per-connection context is cancelled when the client disconnects. Long-
// running handlers (compile, run) kick off goroutines that write back to the
// connection — those goroutines observe the context cancellation and stop.
func (s *Server) Handler(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, nil)
	if err != nil {
		logger.Warn("websocket accept", "err", err)
		return
	}
	defer func() { _ = c.CloseNow() }()

	connID := newID()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	ctx = WithConnectionID(ctx, connID)

	logger.Info("websocket connection", "id", connID, "remote", r.RemoteAddr)

	for {
		env, err := ReadEnvelope(ctx, c)
		if err != nil {
			if !errors.Is(err, context.Canceled) {
				logger.Debug("websocket read", "id", connID, "err", err)
			}
			return
		}

		logger.Debug("ws in", "id", connID, "type", env.Type)

		h := lookup(env.Type)
		if h == nil {
			logger.Warn("unknown event type", "id", connID, "type", env.Type)
			return
		}

		if err := h.Handle(ctx, s, c, env); err != nil {
			logger.Debug("handler error", "id", connID, "type", env.Type, "err", err)
			return
		}
	}
}
