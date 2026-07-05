# 004 - Provar API as a WebSocket Service

## Context

The Go rewrite is one surface from done. The CLI in `apps/provar-cli/` and the engine in `libs/engine/` define the user-facing surface: nine subcommands and a coherent event lifecycle. The GUI client is the last surface, and it needs a transport to the SDK.

Two constraints shape the transport:

1. **The API surface is the SDK surface.** Every wire type falls out of the CLI subcommands and engine event types. No transport-only inventions.
2. **The transport is bi-directional.** Engine compile and run emit streams of progress. The GUI subscribes, but also sends control (stop, pause, resume) and edits (test-file saves) while the stream is live. One persistent connection carrying every message in both directions is the right shape.

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
    "ack": "ab2c…"
  },
  "type": "v1/project/get",
  "data": { … }
}
```

- `meta.id` — uuidv4, required, unique per frame.
- `meta.ts` — ms-since-epoch, sender-clock. Never trusted for ordering.
- `meta.ack` — set when this frame is a reply to a prior frame; carries the original frame's `meta.id`. Empty when this frame is not a reply.
- `type` — versioned identifier. `v1/` prefix mandatory.
- `data` — JSON object, never scalar or array.

There is one type family: `v1/*`. Events flow in both directions. Reads reply (with `meta.ack` set). Writes may reply or not. Server-pushed progress events carry no `meta.ack`.

### 3. Lifecycle

1. Client opens the socket.
2. Either side sends `v1/*`. The other side replies with `v1/*` carrying `meta.ack` for reads.
3. Either side closes the TCP connection to end the session.

Protocol errors close the connection. The server logs and tears down.

### 4. Events

#### Client → server

Writes (no reply expected beyond a single ack-paired status):

- `v1/project/open` — set the active project. `data: { path }`.
- `v1/project/create` — bootstrap a project. `data: { path, sample?, force? }`.
- `v1/project/close` — close the active project.
- `v1/test-file/save` — persist a `.test.yml`. `data: { path, content }`.
- `v1/test-file/create` — create a `.test.yml`. `data: { path, name }`.
- `v1/test-file/delete` — delete a file or directory. `data: { path }`.
- `v1/config/save` — save `.provar/config.yml`. `data: { config }`.
- `v1/settings/save` — save `~/.provar/settings.yml`. `data: { settings }`.
- `v1/compile/start` — start a compile. `data: { test, upTo?, headless? }`. Reply carries `jobId`.
- `v1/run/start` — start a run. `data: { test, pathIndex, upTo?, headless? }`. Reply carries `jobId`.
- `v1/visual/accept` — promote screenshots. `data: { file? }`.
- `v1/job/stop` — stop a job. `data: { jobId }`.
- `v1/job/pause` — pause. `data: { jobId }`.
- `v1/job/resume` — resume. `data: { jobId }`.
- `v1/clean` — remove artefacts. `data: { includeBaselines?, includeLua?, dryRun? }`.

Reads (reply carries `meta.ack` and the data shape shown):

- `v1/project/get` — reply `{ path }`.
- `v1/config/get` — reply `{ config }`.
- `v1/settings/get` — reply `{ settings, home, settingsExists }`.
- `v1/test-file/list` — reply `{ tests: string[] }`.
- `v1/test-file/read` — `data: { path }` → reply `{ content }`.
- `v1/screenshot/get` — `data: { test, pathIndex, taskId }` → reply `{ baseline?, current? }`.
- `v1/node/code` — `data: { test, taskId }` → reply `{ code, upToDate }`.
- `v1/doctor/run` — reply `{ checks: [{ name, ok, error? }] }`.

#### Server → client

Server initiates these. Client routes by `type` and `jobId` (when present). None carry `meta.ack`.

- `v1/compile/started` — `data: { jobId }`.
- `v1/compile/action-started` — `data: { jobId, actionId, name }`.
- `v1/compile/action-finished` — `data: { jobId, actionId, body }`.
- `v1/compile/action-failed` — `data: { jobId, actionId, error }`.
- `v1/compile/finished` — `data: { jobId, status, luaCode?, duration, error? }`.
- `v1/run/started` — `data: { jobId }`.
- `v1/run/task-started` — `data: { jobId, taskId, title }`.
- `v1/run/task-finished` — `data: { jobId, taskId }`.
- `v1/run/task-failed` — `data: { jobId, taskId, error }`.
- `v1/run/visual-triggered` — `data: { jobId, taskId, screenshotBase64 }`.
- `v1/run/finished` — `data: { jobId, status, duration }`.
- `v1/job/state-changed` — `data: { jobId, state: 'paused' | 'resumed' | 'stopped' }`.
- `v1/fs/changed` — `data: { path, kind: 'create' | 'modify' | 'delete' }`.
- `v1/project/closed` — server-initiated close (CLI closed the project, etc.). Client clears state.

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

## Notes for the implementation

- Dispatch: a single `map[string]func(*Conn, Envelope) error` keyed by `type`.
- `jobId` allocation goes in the event handler that starts the job (compile/run). The handler owns the `domain.Job` and the id is its identifier.
- `apps/provar-api` stays thin. Every business-logic decision routes to `libs/engine`, `libs/domain`, `libs/models`. The API is an envelope adapter plus a per-event dispatch table.
