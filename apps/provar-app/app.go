package main

import (
	"context"

	"provar-app/internal/bindings"
)

// App holds the binding instances and the Wails runtime context.
// Each binding embeds bindings.BaseBinding for ctx + cross-cutting
// helpers. The frontend reaches each binding as its own namespace
// (e.g. window.go.main.File.ListTests) — not as App.ListTests.
type App struct {
	ctx context.Context

	File    *bindings.File
	Dialog  *bindings.Dialog
	Shell   *bindings.Shell
	Project *bindings.Project
	Config  *bindings.Config
}

// NewApp returns an App with its binding instances allocated but
// not yet bound to a runtime context. The context is set in startup.
func NewApp() *App {
	return &App{
		File:    &bindings.File{},
		Dialog:  &bindings.Dialog{},
		Shell:   &bindings.Shell{},
		Project: &bindings.Project{},
		Config:  &bindings.Config{},
	}
}

// startup is the Wails lifecycle hook. It wires the runtime context
// into every binding so its helpers (LogErrorf, Emit) can reach it.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.File.Ctx = ctx
	a.Dialog.Ctx = ctx
	a.Shell.Ctx = ctx
	a.Project.Ctx = ctx
	a.Config.Ctx = ctx
}