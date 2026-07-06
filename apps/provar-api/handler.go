package api

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/coder/websocket"

	"github.com/thani-sh/provar/libs/domain"
)

// Handler is the interface every wire-type handler implements. Concrete
// handlers live in apps/provar-api/handlers/ and embed BaseHandler to
// inherit the common cross-cutting helpers — Decode, WriteError, WriteOK,
// WriteReply, LoadProject — so each handler's Handle method does only the
// business logic specific to that wire type.
type Handler interface {
	Handle(ctx context.Context, s *Server, c *websocket.Conn, env Envelope) error
}

// BaseHandler holds the common cross-cutting helpers every wire-type
// handler uses. Concrete handlers embed it (by value) and call the
// helpers as methods on themselves — h.Decode(...), h.WriteError(...),
// h.LoadProject(...), etc. — so the business logic in each Handle method
// stays free of boilerplate.
//
// BaseHandler is stateless; the methods have value receivers. Concrete
// handlers can embed it by value and register instances of themselves
// (no need for pointers).
type BaseHandler struct{}

// Decode parses env.Data into dst and returns a wrapped error on parse
// failure with a standard "invalid data: " prefix. The wrapped error
// preserves the underlying parse error via %w so callers can inspect it.
func (BaseHandler) Decode(env Envelope, dst any) error {
	if err := json.Unmarshal(env.Data, dst); err != nil {
		return fmt.Errorf("invalid data: %w", err)
	}
	return nil
}

// WriteError writes a typed error reply that mirrors the request's wire
// type and echoes its meta id. The error's string form becomes the
// payload's `error` field. Pass-through to the package-level WriteError.
func (BaseHandler) WriteError(ctx context.Context, c *websocket.Conn, env Envelope, err error) error {
	return WriteError(ctx, c, env.Type, env.Meta.ID, err.Error())
}

// WriteOK writes the standard {ok: true} success reply used by every
// write endpoint. The reply type matches the request type and the meta
// id is echoed.
func (BaseHandler) WriteOK(ctx context.Context, c *websocket.Conn, env Envelope) error {
	return WriteEnvelope(ctx, c, env.Type, okReply{OK: true}, env.Meta.ID)
}

// WriteReply writes an arbitrary payload as the success reply. The reply
// type matches the request type and the meta id is echoed.
func (BaseHandler) WriteReply(ctx context.Context, c *websocket.Conn, env Envelope, payload any) error {
	return WriteEnvelope(ctx, c, env.Type, payload, env.Meta.ID)
}

// LoadProject returns the project at projectPath, wrapping the error in
// a "load project: " form on failure. The project is loaded via
// Server.GetOrLoadProject — cache hit on the second call.
func (BaseHandler) LoadProject(s *Server, projectPath string) (*domain.Project, error) {
	p, err := s.GetOrLoadProject(projectPath)
	if err != nil {
		return nil, fmt.Errorf("load project: %w", err)
	}
	return p, nil
}

// okReply is the standard success payload for every write endpoint.
// Lives here (not in handlers/) because it's part of the cross-cutting
// machinery every wire-type handler uses.
type okReply struct {
	OK bool `json:"ok"`
}
