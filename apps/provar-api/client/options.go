// Package client is the reusable Go client for prover-api. Consumers
// (provar-app, internal tools) import this package instead of the raw
// generated stubs so socket dialing, connection lifetime, and service
// accessor wiring live in one place.
package client

import "time"

// DefaultSocketPath is the unix socket the API server listens on when
// --socket is left at its default. Mirrors the server's own default so a
// bare Connect() call lands on the same socket the server bound to.
const DefaultSocketPath = "/tmp/provar.sock"

// DefaultDialTimeout bounds the initial socket dial. Kept short because
// Connect is expected to fail fast when the daemon isn't running —
// callers that want a long retry loop should wrap Connect themselves.
const DefaultDialTimeout = 5 * time.Second
