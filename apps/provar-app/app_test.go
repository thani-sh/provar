package main

import (
	"context"
	"testing"
)

// TestStartupWiresCtxOnEveryBinding guards against reflection-based
// startup silently failing. An interface{} round-trip in the loop
// makes the binding struct non-addressable, so CanSet returns false
// and Ctx stays nil — every runtime call (OpenDirectoryDialog etc.)
// then fails with "invalid context". If this test fails, the loop
// in App.startup is broken.
func TestStartupWiresCtxOnEveryBinding(t *testing.T) {
	a := NewApp()
	if a.File.Ctx != nil {
		t.Fatalf("precondition: File.Ctx should be nil before startup, got %v", a.File.Ctx)
	}

	a.startup(context.Background())

	cases := map[string]context.Context{
		"File":    a.File.Ctx,
		"Dialog":  a.Dialog.Ctx,
		"Shell":   a.Shell.Ctx,
		"Project": a.Project.Ctx,
		"Config":  a.Config.Ctx,
		"History": a.History.Ctx,
	}
	for name, ctx := range cases {
		if ctx == nil {
			t.Errorf("%s.Ctx is nil after startup", name)
		}
	}
}

// TestBoundBindingsEnumeratesPointerStructFields locks in that every
// pointer-to-struct field on App is part of the Wails Bind list. If
// you add a new binding field, this test breaks — and that's the
// point: forcing the addition to be deliberate.
func TestBoundBindingsEnumeratesPointerStructFields(t *testing.T) {
	a := NewApp()
	got := a.boundBindings()
	want := 6 // File, Dialog, Shell, Project, Config, History
	if len(got) != want {
		t.Errorf("boundBindings() returned %d entries, want %d (every pointer-to-struct field on App)", len(got), want)
	}
}
