# 007 - GUI Bindings Follow the BaseHandler-Style One-Struct-per-Concern Pattern

## Context

`provar-api` has a working design convention: each wire-type handler is its own file, its own struct, embeds a stateless `BaseHandler` for cross-cutting helpers. Adding a handler = one new file, two new types, one `init()` registration (see ADR-004). The Wails binding layer needs a similar convention so the next binding author doesn't invent their own.

## Decision

`apps/provar-app/internal/bindings/` follows the same convention, adapted to Wails's struct-based binding model.

```
internal/bindings/
  base.go         # BaseBinding — ctx + LogErrorf + Emit
  file.go         # File struct, embeds BaseBinding
  dialog.go       # Dialog struct (desktop only — native folder picker)
  shell.go        # Shell struct (desktop only — open external URLs)
  project.go      # Project struct
  config.go       # Config struct
```

- `BaseBinding` is stateless beyond the Wails runtime `context.Context`. Helpers (`LogErrorf`, `Emit`) grow only when two or more bindings need the same thing.
- Each binding is a struct that embeds `BaseBinding`. Methods on it are Wails-bound directly.
- `App` in `app.go` holds the binding instances; `startup` constructs them with the ctx; `main.go` registers them in `Bind: []interface{}{...}`.
- The JS namespace is the struct name (`window.go.main.File.ListTests`), not a kitchen-sink `window.go.main.App.ListTests`.

Desktop-only bindings (`Dialog`, `Shell`) follow the same convention for consistency, even though they have no `provar-api` equivalent.

## Consequences

- Adding a binding = one new file + one new struct + embed `BaseBinding` + two lines in `App` and `Bind`. No central registry, no factory function, no string-key dispatch.
- `BaseBinding` stays small. New helpers are added on demand, not speculatively.
- The mirror to `provar-api` is in the convention, not the wire. Wails doesn't use envelopes; we don't fake one.

**Rejected**

- *One `App` struct with all methods.* Becomes a kitchen sink. Methods don't share state, but they get bundled anyway. The next person can't find anything.
- *Generic `Resource[T]` interface.* Forces all bindings through the same I/O shape. Each binding is genuinely different (file vs dialog vs shell); abstracting is ceremony.
- *Wails bindings call `provar-api`'s handlers.* Couples the desktop to a network service. Domain logic lives in `libs/`, not in either surface (see ADR-006).
