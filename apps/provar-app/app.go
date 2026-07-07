package main

import (
	"context"
	"reflect"

	"provar-app/internal/bindings"
)

// App holds the binding instances and the Wails runtime context.
// Each binding embeds bindings.BaseBinding for ctx + cross-cutting
// helpers. The frontend reaches each binding as its own namespace
// (e.g. window.go.main.File.ListTests) — not as App.ListTests.
//
// Pointer-to-struct fields are enumerated by reflection (see
// boundBindings) and used by both main.go's Wails Bind list and
// startup's Ctx wiring. Adding a new binding = one new field here.
type App struct {
	ctx context.Context

	File    *bindings.File
	Dialog  *bindings.Dialog
	Shell   *bindings.Shell
	Project *bindings.Project
	Config  *bindings.Config
	History *bindings.History
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
		History: &bindings.History{},
	}
}

// boundBindings returns every pointer-to-struct field as a slice
// of interface{}. Used by main.go (Wails' Bind list) and startup
// (Ctx wiring) so the struct fields stay the single source of truth.
func (a *App) boundBindings() []interface{} {
	v := reflect.ValueOf(a).Elem()
	out := make([]interface{}, 0, v.NumField())
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		if f.Kind() != reflect.Ptr || f.IsNil() {
			continue
		}
		if f.Type().Elem().Kind() != reflect.Struct {
			continue
		}
		out = append(out, f.Interface())
	}
	return out
}

// startup is the Wails lifecycle hook. It wires the runtime context
// into every binding so its helpers (LogErrorf, Emit) can reach it.
//
// We walk App's own fields (addressable, because a is *App) rather
// than re-using boundBindings(): pulling the bindings through an
// interface{} slice loses addressability, the struct's Ctx field
// comes back non-settable, and the Set silently no-ops — every
// runtime call then fails with "invalid context".
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	ctxVal := reflect.ValueOf(ctx)
	v := reflect.ValueOf(a).Elem()
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		if field.Kind() != reflect.Ptr || field.IsNil() {
			continue
		}
		elem := field.Elem()
		if elem.Kind() != reflect.Struct {
			continue
		}
		ctxField := elem.FieldByName("Ctx")
		if !ctxField.IsValid() || !ctxField.CanSet() {
			continue
		}
		ctxField.Set(ctxVal)
	}
}
