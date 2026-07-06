package api

import (
	"context"

	"github.com/coder/websocket"
)

// Handler is the signature every wire-type handler implements. It receives
// the per-connection ctx (cancelled when the client disconnects), the
// server-wide state, the websocket conn, and the decoded envelope.
//
// Handlers decode env.Data into their own typed shape. They reply via
// WriteEnvelope(ctx, c, type, data, env.Meta.ID) — the third argument is the
// type, the fourth the payload, the fifth the ak (echoes the request id so
// the client can correlate).
type Handler func(ctx context.Context, s *Server, c *websocket.Conn, env Envelope) error

// dispatch is the central registry of wire types to handlers. Populated by
// NewServer via init-style registration in each handlers/*.go file.
var dispatch = map[string]Handler{}

// Register adds a handler to the dispatch table. Called from package init()
// in handlers/*.go files — keeps registration co-located with the handler.
func Register(typ string, h Handler) {
	dispatch[typ] = h
}

// lookup returns the handler for typ, or nil if no handler is registered.
// Server logs and closes the connection when a handler is missing — that's
// a protocol-level error, not a domain error.
func lookup(typ string) Handler {
	return dispatch[typ]
}
