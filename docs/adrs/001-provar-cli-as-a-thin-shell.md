# 001 - Provar CLI as a Thin Shell

## Context

The Bun-based CLI in `.previous/apps/provar-cli` carried ~500 lines of cross-cutting plumbing (signal handling, exit codes, telemetry rendering, file walking, ANSI helpers) plus per-command `utils/` folders. Most of that code had nothing to do with the CLI surface — it was business logic that belonged in `libs`.

## Decision

The Go CLI is a thin delivery mechanism. Every line of business logic — scenario parsing, compilation, browser execution, settings — lives in `libs`. The CLI only parses argv and dispatches, walks the project directory (stdlib `filepath.WalkDir`), calls SDK functions and writes results to disk, and prints events streamed from `domain.Job.Subscribe()`. Cross-cutting code in `apps/provar-cli/cli/` covers CLI mechanics only (command interface, exit codes, signal cancellation). No engine, compiler, runner, or browser code lives under `apps/provar-cli/`.

## Consequences

File layout is flat (`setup.go`, `compile.go`, `run.go`) because nothing is complex enough to nest. Adding a command is one new file plus one registry entry — no edits to `main.go`, no new folders. Cross-cutting concerns stay small: the Bun version's 130-line signal module collapses to four lines via `signal.NotifyContext`. The CLI is replaceable — a future GUI that uses the same SDK inherits all of this work for free. Any behaviour that feels like business logic gets pushed down to the SDK first.

See `docs/CLI.md` for the full layout and per-command contract.
