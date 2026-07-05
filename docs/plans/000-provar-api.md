# 000 - provar-api on gRPC

A backend service that exposes the existing `libs/engine` and `libs/domain` to in-process clients over gRPC. The CLI keeps calling the libs directly; the API exists for surfaces that can't (or shouldn't) shell out — primarily the `provar-app` graphical editor.

## 1. Goal

`provar-api` is a long-running Go process that owns the engine. Clients open a project, list and edit scenarios, compile (with streamed progress), and run (with streamed task events and screenshots). No new business logic lives in the API — it is a thin RPC layer over the libs.

## 2. Scope

**In scope**

- Load, list, init, and validate projects on disk.
- Read and write individual scenario files.
- Compile scenarios to Lua with streamed per-action progress.
- Run compiled scenarios with streamed task events and visual snapshots.
- Accept visual baselines.
- Local environment diagnosis (`doctor`) and artifact cleanup (`clean`).
- A reusable Go client package so consumers (the editor, internal tools) don't reimplement socket dialing.

**Out of scope**

- Cross-project orchestration (CI runs, batch jobs) — single-project at a time.
- Cloud-hosted execution. The API runs locally alongside the editor; same trust boundary as today.

## 3. Why gRPC

- `domain.Job` already produces an event stream (see `libs/domain/asyncjob.go` and `libs/engine/runner.go`). Server-streaming RPCs map 1:1 to that shape; REST/SSE would reimplement it.
- `protobuf` gives compile-time schema and typed clients for the Go desktop editor and any future internal Go client.
- Generated stubs replace hand-written JSON DTOs — `libs/engine/types.go` already does the work of describing these payloads.

The browser cost (no native gRPC without grpc-web) is not a blocker today: `provar-app` is a Go desktop app. If a web editor ever lands, the proto can also be served via grpc-gateway for REST access without changing the schema.

## 4. Decisions worth ADR-ing

Lock these before writing code:

- **Schema source of truth.** `.proto` files live under `apps/provar-api/proto/provar/v1/` next to the code that owns them. Generated Go ships under `apps/provar-api/gen/provar/v1/`, committed. A reusable Go client lives at `apps/provar-api/client/`. One ADR.
- **Transport.** Vanilla gRPC on a unix socket by default (`/tmp/provar.sock`) so the editor and CLI share a local socket without TCP exposure. TCP port opt-in via `--listen` for remote-editor work. One ADR.
- **Auth.** None at v1. Same trust boundary as the CLI; the socket file permission is the boundary. Add a token field later if a remote editor becomes a real use case.

## 5. Service shape

```proto
package provar.v1;

service ProjectService {
  rpc Open(OpenRequest)       returns (Project);
  rpc Init(InitRequest)       returns (Project);
  rpc List(ListRequest)       returns (ListResponse);
}

service ScenarioService {
  rpc Get(GetRequest)         returns (Scenario);
  rpc Save(SaveRequest)       returns (Scenario);
  rpc Validate(ValRequest)    returns (ValidationResult);
}

service CompileService {
  rpc Compile(CompileRequest) returns (stream CompileEvent);
}

service RunService {
  rpc Run(RunRequest)         returns (stream RunEvent);
  rpc AcceptBaseline(AcceptBaselineRequest) returns (BaselineResult);
}

service UtilityService {
  rpc Doctor(DoctorRequest)   returns (DoctorReport);
  rpc Clean(CleanRequest)     returns (CleanReport);
}
```

`Project`, `Scenario`, `Action` mirror `libs/domain` types — same fields, same field names. No internal-Go renames.

`RunEvent` is a oneof over the existing `domain.Job` event types (see `libs/engine/runner.go` lines 17–23). One event type per Go event; `data` payload stays the same shape. `CompileEvent` is a smaller set: `compile-started`, `action-started`, `action-finished`, `compile-finished`. Refactor `engine.Compiler` to use `domain.Job` so the streaming model is uniform.

## 6. Package layout

```
apps/provar-api/
  main.go                         # cmd entry; flag parsing, signal handling
  server.go                       # *grpc.Server wiring; service registration
  project.go                      # ProjectService impl
  scenario.go                     # ScenarioService impl
  compile.go                      # CompileService impl (wraps engine.Compiler)
  run.go                          # RunService impl (wraps engine.Runner)
  doctor.go                       # UtilityService.Doctor impl
  clean.go                        # UtilityService.Clean impl
  convert.go                      # proto <-> libs/domain converters
  proto/provar/v1/                # committed .proto sources
    project.proto
    scenario.proto
    compile.proto
    run.proto
    utility.proto
    common.proto
  gen/provar/v1/                  # generated Go (committed)
  client/                         # reusable Go client (consumed by provar-app, internal tools)
    client.go                     # ProvarAPIClient wrapper over generated stubs
    options.go                    # connection options (socket path, dial timeout, etc.)
```

The proto and gen live with the service they describe. The client package is what other Go code imports; it hides gRPC connection plumbing and exposes typed methods that map to services.

`apps/provar-api/package.json` becomes vestigial — delete it. The Go module is the only thing in that directory.

`convert.go` is the single boundary that knows both proto and domain types. No leaking proto types into `libs/`.

## 7. Build and codegen

- Add `google.golang.org/grpc`, `google.golang.org/protobuf` as direct deps in `go.mod` (already present as indirect — promote).
- `buf` for lint + generation. `buf.gen.yaml` at `apps/provar-api/` emits Go into `apps/provar-api/gen/provar/v1/` from `apps/provar-api/proto/provar/v1/`.
- Generation runs via `go generate ./...` calling `buf generate`. Output committed, so contributors don't need `buf` to build.
- Go import path: `github.com/thani-sh/provar/apps/provar-api/gen/provar/v1` for stubs, `github.com/thani-sh/provar/apps/provar-api/client` for the reusable client.
- `go fmt ./...` and `go vet ./...` as the verification gate (per `AGENTS.md`).

## 8. Wiring to libs

Each RPC handler is a thin adapter:

- `ProjectService.Open` → `domain.LoadProject(path)`.
- `CompileService.Compile` → spawns a `domain.Job`, runs `engine.Compiler` in a goroutine, drains `Job.Subscribe()` into `stream.Send()`. The compiler needs a small refactor to use `domain.Job` so listeners see progress (one new event per action, plus terminal).
- `RunService.Run` → already emits via `domain.Job`; just convert each `domain.Event` to a `RunEvent` and forward.

`engine.CompileOptions` and `engine.RunOptions` carry the proto-derived args straight through. No logic in the API layer.

The API process owns the browser session for the lifetime of a Compile/Run RPC. Multiple concurrent RPCs get separate sessions, matching today's CLI behaviour (one browser per command).

## 9. Phased rollout

Five phases, sequenced. Each phase ends with a green `go vet ./...`, `go test ./...`, and one manual smoke test from a sample client.

1. **Skeleton.** `apps/provar-api/main.go` boots a `grpc.Server`, listens on a unix socket, registers an empty `Health` service. Confirms the build pipeline (proto, codegen, server bring-up).
2. **Project + Scenario.** Read-only: `Open`, `Init`, `List`, `Get`, `Validate`. Validates the proto↔domain converter pattern before write paths land.
3. **Compile.** `CompileService.Compile` over a server stream. Requires the `engine.Compiler` refactor to emit `domain.Job` events. Lands a new `CompileService` test that drives a one-action scenario against the live demo.
4. **Run.** `RunService.Run` over a server stream plus `AcceptBaseline`. Closes the loop with the editor's primary use case.
5. **Utility + Client.** `UtilityService.Doctor` and `UtilityService.Clean` (unary RPCs — no streaming) plus the reusable `apps/provar-api/client` package. Confirms the API is usable without the CLI, and gives the editor (and any internal tool) a typed entry point that hides socket dialing.

## 10. Verification

- **Unit tests** per handler using `bufconn` (in-process gRPC) — no port binding, no flakiness. Same coverage as the existing `libs/*_test.go` style.
- **Smoke test** in `apps/provar-api/server_test.go`: open the sample project from `domain.SampleDemoURL`, compile one action, assert `CompileEvent.compile-finished` arrives. Mirrors how the CLI exercises the engine today.
- **No new test infrastructure.** `go test ./...` is the gate. No docker-compose, no integration harness, no live LLM calls in CI.
- **Live LLM calls stay behind a `-short` skip flag** (already the convention in `libs/`); the smoke test compiles against a mock provider by default.

## 11. What's not in this plan

- Authentication, multi-tenancy, remote editor support.
- Persisting scenario edits to a database — the API still writes YAML on disk; the editor's responsibility is the graph UI, not state ownership.
- Replacing the CLI's direct-lib calls with gRPC client calls. The CLI is a single user; IPC overhead isn't worth it. (Revisit if the CLI ever spawns its own daemon.)
- A web frontend talking to this API. That's a separate surface (`provar-app` is the editor; `provar-web` is the public docs site per `docs/SYSTEMS.md`).