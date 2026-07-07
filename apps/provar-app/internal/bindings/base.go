// Package bindings holds the Wails-bound structs that the provar-app
// frontend calls. Each struct is one concern (file IO, dialog, shell,
// project, config); each embeds BaseBinding for the Wails runtime
// context and shared helpers. Adding a new binding = new file + new
// struct + embed BaseBinding + two lines in app.go and main.go.
package bindings

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// BaseBinding holds the Wails runtime context and provides cross-cutting
// helpers every binding uses. Concrete bindings embed it (by value).
// Helpers grow only when two or more bindings actually need them.
type BaseBinding struct {
	Ctx context.Context
}

// LogErrorf wraps runtime.LogErrorf with a "binding: " prefix.
func (b BaseBinding) LogErrorf(format string, args ...any) {
	runtime.LogErrorf(b.Ctx, "binding: "+format, args...)
}

// Emit wraps runtime.EventsEmit — used by streaming endpoints later.
func (b BaseBinding) Emit(name string, data ...any) {
	runtime.EventsEmit(b.Ctx, name, data...)
}