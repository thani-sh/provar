# 004 - Provar API as a WebSocket Service

## Context

The Go rewrite is one surface from done. The CLI in `apps/provar-cli/` and the engine in `libs/engine/` define the user-facing surface: nine subcommands and a coherent event lifecycle. The GUI client is the last surface, and it needs a transport to the SDK.

Two constraints shape the transport:

1. **The API surface is the SDK surface.** Every wire type falls out of the CLI subcommands and engine event types. No transport-only inventions.
2. **The transport is bi-directional.** Engine compile and run emit streams of progress. The GUI subscribes, but also sends control (stop, pause, resume) and edits (file saves) while the stream is live. One persistent connection carrying every message in both directions is the right shape.

## Decision

`apps/provar-api` is a single Go binary that accepts WebSocket connections from clients and bridges them to the SDK. One process, one port, one connection per client. No REST, no RPC registry, no per-job connection.

### 1. Transport

- Endpoint: `ws://127.0.0.1:<port>/v1/ws`. Localhost only.
- Plain text JSON frames, one message per frame.
- WebSocket protocol-level ping/pong handles keepalive. No application-level ping.
- No authentication. Defer until we ship remote clients.

### 2. Envelope

Every frame, both directions, is one JSON object:

```json
{
  "meta": {
    "id": "5f1d…",
    "ts": 1718000000123,
    "ak": "ab2c…"
  },
  "type": "v1/project/compile",
  "data": { … }
}
```

- `meta.id` — uuidv4, required, unique per frame.
- `meta.ts` — ms-since-epoch, sender-clock. Never trusted for ordering.
- `meta.ak` — set when this frame is a reply to a prior frame; carries the original frame's `meta.id`. Empty when this frame is not a reply.
- `type` — versioned identifier. `v1/` prefix mandatory.
- `data` — JSON object, never scalar or array.

There is one type family: `v1/*`. Events flow in both directions. Reads reply (with `meta.ak` set). Writes may reply or not. Server-pushed progress events carry no `meta.ak`.

A reply's `type` mirrors the request's `type` — both the success reply and an error reply carry the same `type` as the message they answer. The client correlates replies to requests via `meta.ak`, not via `type`.

### 3. Lifecycle

1. Client opens the socket.
2. Either side sends `v1/*`. The other side replies with `v1/*` carrying `meta.ak` for reads.
3. Either side closes the TCP connection to end the session.

Protocol errors close the connection. The server logs and tears down.

### 4. Events

The catalog has three top-level entities: `project` (everything that operates on a project), `settings` (global user settings — per-user, not per-project), and `doctor` (global preflight checks — not project-specific). Project-scoped commands and events are nested under `v1/project/*`. The compile/run event families stay nested as `v1/project/compile/*` and `v1/project/run/*`; job-control events nest under `v1/project/job/*`.

#### Client → server

Writes (no reply expected beyond a single ak-paired status):

- `v1/project/create` — bootstrap a project. `data: { path, sample?, force? }`.
- `v1/project/file/save` — persist a `.test.yml`. `data: { path, content }`. Creates the file if missing.
- `v1/project/file/delete` — delete a file or directory. `data: { path }`.
- `v1/project/config/save` — save `.provar/config.yml`. `data: { config }`.
- `v1/project/visual/accept` — promote screenshots. `data: { file? }`.
- `v1/project/clean` — remove artefacts. `data: { includeBaselines?, includeLua?, dryRun? }`.
- `v1/project/compile` — start a compile. `data: { project, file, upTo?, headless? }`.
- `v1/project/run` — start a run. `data: { project, file, pathIndex, upTo?, headless? }`.
- `v1/project/job/stop` — stop a job. `data: { jobId }`.
- `v1/project/job/pause` — pause. `data: { jobId }`.
- `v1/project/job/resume` — resume. `data: { jobId }`.
- `v1/settings/save` — save `~/.provar/settings.yml`. `data: { settings }`.

Reads (reply carries `meta.ak` and the data shape shown):

- `v1/project/file/list` — reply `{ files: string[] }`.
- `v1/project/file/load` — `data: { path }` → reply `{ content }`.
- `v1/project/config/load` — reply `{ config }`.
- `v1/project/visual/load` — `data: { file, actionId }` → reply `{ baseline?, current? }`.
- `v1/project/action/load` — `data: { file }` → reply `{ code, upToDate }`.
- `v1/settings/load` — reply `{ settings, home, settingsExists }`.
- `v1/doctor/run` — reply `{ checks: [{ name, ok, error? }] }`.

#### Server → client

Server initiates these. Client routes by `type` and `jobId` (when present). None carry `meta.ak`.

- `v1/project/compile/started` — `data: { jobId }`.
- `v1/project/compile/action-started` — `data: { jobId, actionId, name }`.
- `v1/project/compile/action-finished` — `data: { jobId, actionId, body }`.
- `v1/project/compile/action-failed` — `data: { jobId, actionId, error }`.
- `v1/project/compile/finished` — `data: { jobId, status, luaCode?, duration, error? }`.
- `v1/project/run/started` — `data: { jobId }`.
- `v1/project/run/action-started` — `data: { jobId, name }`.
- `v1/project/run/action-finished` — `data: { jobId }`.
- `v1/project/run/action-failed` — `data: { jobId, error }`.
- `v1/project/run/visual-triggered` — `data: { jobId, screenshotBase64 }`.
- `v1/project/run/finished` — `data: { jobId, status, duration }`.
- `v1/project/job/state-changed` — `data: { jobId, state: 'paused' | 'resumed' | 'stopped' }`.
- `v1/project/fs/changed` — `data: { path, kind: 'create' | 'modify' | 'delete' }`.

### 5. Out of scope for v1

- **Authentication.** Defer until remote clients.
- **Multi-client.** One client per session.
- **Persistence.** Stateless. Project state lives on disk; session state lives in active `domain.Job`s.

## Consequences

**Pros**

- The envelope matches the SDK. `domain.Job.Subscribe()` yields events that translate one-to-one to server-pushed wire events.
- One connection per client. No per-job bookkeeping.
- One type family. No taxonomy to memorise. The dispatch table is a single `map[string]handler` keyed by `type`.

**Cons**

- The server is a long-running process with a port and a lifecycle. The CLI is one-shot. Two distribution stories, two binaries, two sets of CI checks.
- One bug in the server's read loop takes down every GUI simultaneously.
- The versioned type prefix is a soft contract — review, not machinery.

**Rejected**

- *REST + SSE.* Two protocols, two surfaces. Cuts against "one connection per client."
- *gRPC.* Code-gen, extra tooling, foreign mental model. WebSocket+JSON is enough throughput for one human operator per project.
- *Per-job WebSocket.* Same problems as before; more moving parts.
