# 004 - Provar Proto Schema Source of Truth

## Context

`provar-api` will serve the graphical editor (`provar-app`) and any future Go-side consumer over gRPC. The schema needs a single source of truth that multiple services compile against, and that survives the addition of new transports (grpc-gateway, Connect, non-Go clients) without re-authoring types. Today there is no shared schema in the repo.

The naive options each have a problem: protobuf-as-build-step pins every contributor to a `buf`/`protoc` install and bakes codegen output into CI; per-service protos let schemas drift the moment two services disagree on a field name; JSON Schema loses the typed-client ergonomics that make gRPC attractive in the first place.

## Decision

The `.proto` files under `apps/provar-api/proto/provar/v1/` are the authoritative schema. Generated Go code under `apps/provar-api/gen/provar/v1/` is **committed** to the repo and ships as part of the module.

- Codegen runs via `buf generate`, invoked from `go generate ./...`. There is no codegen step in the regular `go build` path.
- A proto change lands as one PR with two diffs: edit the `.proto`, run `buf generate`, commit both `apps/provar-api/proto/` and `apps/provar-api/gen/`. Both move together or neither does.
- The Go package import is `github.com/thani-sh/provar/apps/provar-api/gen/provar/v1`. Server code in `apps/provar-api/` and the reusable client in `apps/provar-api/client/` import it like any other module dep.
- Tool versions are pinned in `buf.yaml` and `buf.gen.yaml` so contributors get reproducible output.

## Consequences

**Pros**

- No `buf`/`protoc` requirement for contributors who only consume the API. They read `gen/` and write handlers against the typed stubs.
- The compiled Go is the single runtime truth — `go vet`, `go test`, `go build` all see the same definitions, so there is no "schema and build drifted" failure mode.
- The same `.proto` can later be served via grpc-gateway for REST, or compiled to TypeScript for a web client, without re-authoring the schema.
- Generated stubs replace hand-written JSON DTOs — same ergonomics, less code to maintain.

**Cons**

- Contributors who edit protos do need `buf` installed, and PRs touching protos carry two diffs (`.proto` + `gen/`) that are harder to review than a single-file change.
- Codegen output churns on tooling upgrades (newer `buf`, new `google.golang.org/protobuf`). The repo will need the occasional "refresh generated code" PR with no behaviour change.
- Two places to keep in sync manually. Mitigated by a CI check (`buf lint` plus a diff check) that fails the PR if `gen/` is stale relative to `proto/`.

**Rejected**

- *Build-time codegen.* Lets the repo ship only `.proto` and lets CI enforce consistency. Costs every contributor a `buf`/`protoc` install on first build, and turns the build graph into "the schema is whatever `buf` happens to produce today" — silent breakage when the toolchain moves.
- *Per-service protos.* Each service owns its own schema. Two services that share a `Project` type end up with two `project.proto` files that drift within a sprint.
- *JSON Schema / OpenAPI as the source.* Drops the typed-client win for Go consumers and forces a separate, hand-maintained proto layer for gRPC later.

See `docs/plans/000-provar-api.md` §4 and §7 for the rationale chain that leads here.