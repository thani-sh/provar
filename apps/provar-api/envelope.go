package api

import (
	"context"
	"encoding/json"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/thani-sh/suuid-go"
)

// Meta is the envelope metadata. id and ts are required on every frame;
// ak is set on replies (carries the original frame's id).
type Meta struct {
	ID string `json:"id"`
	TS int64  `json:"ts"`
	Ak string `json:"ak,omitempty"`
}

// Envelope is the wire shape of every frame in both directions. Data stays as
// json.RawMessage so handlers can decode it into per-type structs without a
// double-pass through map[string]any.
type Envelope struct {
	Meta Meta            `json:"meta"`
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// NewMeta builds a fresh Meta with a generated id and the current timestamp.
// Used by Read and Write paths.
func NewMeta() Meta {
	return Meta{
		ID: newID(),
		TS: time.Now().UnixMilli(),
	}
}

// ReadEnvelope reads one frame from the connection into an Envelope.
func ReadEnvelope(ctx context.Context, c *websocket.Conn) (Envelope, error) {
	var env Envelope
	err := wsjson.Read(ctx, c, &env)
	return env, err
}

// WriteEnvelope writes one frame to the connection. data is anything
// JSON-marshalable; it's encoded inline.
func WriteEnvelope(ctx context.Context, c *websocket.Conn, typ string, data any, ak string) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return wsjson.Write(ctx, c, Envelope{
		Meta: Meta{ID: newID(), TS: time.Now().UnixMilli(), Ak: ak},
		Type: typ,
		Data: raw,
	})
}

// newID generates a short base62 ID. Panics on failure — entropy exhaustion
// is unrecoverable for an event stream that depends on unique IDs.
func newID() string {
	id, err := suuid.V4()
	if err != nil {
		panic("api: generate id: " + err.Error())
	}
	return id
}

// ErrorReply is the failure data shape sent when a handler can't fulfil a
// request. The reply uses the same wire type as the request, with the error
// string in `data.error` — the client matches on meta.ak and inspects
// data.error to distinguish success from failure.
type ErrorReply struct {
	Error string `json:"error"`
}

// WriteError sends a typed error reply. Used by every handler that wants to
// surface a domain-level error without closing the connection.
func WriteError(ctx context.Context, c *websocket.Conn, typ, ak, msg string) error {
	return WriteEnvelope(ctx, c, typ, ErrorReply{Error: msg}, ak)
}
