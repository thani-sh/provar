# 006 - Desktop App is a Peer of prover-api, Not a Client

## Context

Three surfaces: `provar-cli` (one-shot CLI), `provar-api` (long-running WebSocket service for remote clients per ADR-004), and the upcoming `provar-app` (desktop GUI). A natural reading of "we have a WebSocket API" is "the GUI should use it."

## Decision

`provar-app` is a **peer of `provar-api`**, not a client. All three surfaces call into `libs/domain` and `libs/engine` directly. The GUI does NOT connect to the WebSocket service.

## Why

- The WebSocket service exists for remote clients. The GUI is in-process, on the same machine, with no network round-trip needed.
- Wails bindings are direct Go method calls. Marshaling through a JSON envelope over a local WebSocket is ceremony.
- The `libs/domain` and `libs/engine` boundary is the right seam. Three surfaces, one domain.
- Tests are easier: each surface has a focused test surface; the WebSocket layer isn't in the GUI's critical path.

## Consequences

- Wails bindings (`apps/provar-app/internal/bindings/`) are the GUI's adapter — direct method calls, no envelopes, no meta ids, no JSON decode round-trip.
- `provar-api` stays focused on remote clients. We don't add a "GUI mode" to it.
- Sharing logic across surfaces is via `libs/`, not via the network. This was already true for the CLI; the GUI extends it.
- The convention for how Wails bindings are structured lives in ADR-007.

**Rejected**

- *GUI connects to the WebSocket service.* Adds an in-process WebSocket server just to be a client of it. Two adapters in the critical path for no benefit.
- *Wails bindings call `provar-api`'s handlers directly.* Couples the GUI to a server it doesn't need. Domain logic lives in `libs/`, not in either surface.
