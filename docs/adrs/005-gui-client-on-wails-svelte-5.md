# 005 - GUI Client on Wails + Svelte 5

## Context

The Bun→Go migration leaves the GUI client as the last surface. `apps/provar-app.old` is the Bun + Electrobun reference; we need a Go-native replacement. The choice is committed for years once made, so it deserves a record.

## Decision

`apps/provar-app` is **Wails + Svelte 5 + Go**.

- **Wails** uses the OS webview (WKWebView / WebView2 / WebKitGTK). No bundled browser, no Chromium binary, single small Go binary.
- **Svelte 5 with runes.** The canvas needs fine-grained reactivity tied to typed stores — runes map cleanly to the way the Go side thinks about state.
- **Go bindings** call `libs/domain` and `libs/engine` directly. The GUI is a peer of `provar-cli` and `provar-api`, not a client of either (see ADR-006).

## Consequences

**Pros**

- ~10MB single binary instead of Electron's 100MB+. Webview-native is the right default for a desktop tool.
- One language on the backend (Go) for all three surfaces. The CLI's lessons about thin adapters and SDK boundaries carry over for free.
- Runes give us `$state` / `$derived` / `$effect` as primitives, no virtual DOM, no framework lock-in beyond the Svelte 5 SFC format.

**Cons**

- Wails is Go-only. If we ever want non-Go bindings, the desktop app stops being the natural surface to add them to.
- Svelte 5 is recent (2024). Runes are stable but ecosystem is younger than Svelte 4 stores.
- Webview rendering quirks are real: macOS 26 needs the ATS exception, the Wails event WebSocket has macOS-specific issues. We patch as they come up.

**Rejected**

- *Tauri.* Rust-only. We're a Go rewrite, not a Rust one.
- *Electron.* Bundled Chromium, 100MB+ binary, slower startup. Webview-native wins.
- *Continue with Bun/Electrobun.* We're leaving the Bun ecosystem.
