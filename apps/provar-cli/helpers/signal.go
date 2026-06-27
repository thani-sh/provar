package helpers

import (
	"context"
	"os/signal"
	"syscall"
)

// WithSignal returns a context that is cancelled when the process receives SIGINT or SIGTERM.
// The cancel function must be called to release resources.
func WithSignal(parent context.Context) (context.Context, context.CancelFunc) {
	return signal.NotifyContext(parent, syscall.SIGINT, syscall.SIGTERM)
}
