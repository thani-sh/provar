# Port provar-app from Electrobun to Wails

Port `apps/provar-app.old` (Electrobun + Svelte) into the new `apps/provar-app` (Wails + Svelte 5 + Go), phase by phase. Each phase ends with a runnable app you can exercise end-to-end.

---

## 0. Current state

`apps/provar-app` is on `main` and has:

- Wails shell with `TitleBarHiddenInset`, translucent window, tinted background
- Tailwind v4 + `lucide-svelte` wired in
- `Welcome.svelte` (empty-state view) — buttons are no-ops
- Drag region at the top of `App.svelte`
- No stores, no Go bindings, no project state

The old Electrobun app at `apps/provar-app.old` is the source of truth for what to port.

---

## 1. Design patterns (apply to every phase below)

These conventions are derived from how `apps/provar-api` reuses code without forcing it. Translate them to Svelte 5 / TypeScript and follow them whenever a phase introduces a new shape, modal, panel, or store.

### 1.1 Why provar-api is the model

`provar-api` has 30+ wire-type handlers that all need the same six things: decode a JSON envelope, write a typed error, write a success reply, load a project, echo the request id, wrap errors with a `load project: …` prefix. Without a convention, each handler would duplicate all of that.

The solution there:

- One `BaseHandler` struct (stateless, value receiver) holds the cross-cutting helpers — `Decode`, `WriteError`, `WriteOK`, `WriteReply`, `LoadProject`. 79 lines total.
- Each concrete handler is its own file: `type projectFileListHandler struct { api.BaseHandler }`. It registers itself in `init()` with `api.Register("v1/project/file/list", &projectFileListHandler{})`.
- The facade (`handlers/handlers.go`) is 21 lines — just blank imports that pull in every handler's `init()`.

Result: a new endpoint is a new file, no other wiring. Each handler file is 30–60 lines. The base struct never grows.

### 1.2 The four rules

1. **One file per concern.** Even small ones. If two things change for different reasons, they live in different files.
2. **Cross-cutting helpers live in a base type that concrete types embed or compose.** No copy-pasted glue code; no base class that grows a new method every time someone needs a new helper.
3. **Pure functions get extracted from classes.** Anything that doesn't need `this` becomes a top-level function in its own file. State-holders and pure logic don't share a file.
4. **Adding a new thing is one new file, not a registry edit.** No "register your component here" lists in a central file. The module graph wires it.

### 1.3 Shapes (canvas) — concrete pattern

The old app has 5 shape files (`NodeShape`, `StartShape`, `EndShape`, `TaskShape`, `ConnectorShape`). `StartShape` and `EndShape` share 80% of their body — only the `nodeId` constant and the title differ. That's the duplication to fix; everything else is fine as one-class-per-file.

The new layout:

```
lib/canvas/
  shapes/
    shape.ts        # NodeShape — base container, layout, label, opacity
    start.ts        # StartShape — extends NodeShape, "Start" pass-through node
    end.ts          # EndShape — extends NodeShape, "End" pass-through node
    task.ts         # TaskShape — extends NodeShape, state-aware node
    connector.ts    # ConnectorShape — edge between two nodes
  icons.ts          # pure buildIconRow(state, flags) → PIXI.Container
  state.ts          # pure resolveState / normalizeState helpers
  layout.ts         # pure computeDepths / assignPositions
  connections.ts    # pure drawConnections
  renderer.ts       # GraphRenderer class — wires the above, <200 lines
  viewport.ts       # pan/zoom
  constants.ts      # colors, sizes
  index.ts          # facade: re-exports the public surface
```

Key points:

- `shapes/` is a directory because the shape classes share PIXI imports and a common base. One file per shape, named after the shape (`start.ts` for `StartShape`, not `start-shape.ts`) — pairing the filename with the class is the rule.
- `StartShape` and `EndShape` are separate files. The 5-line duplication between them is acceptable — they may diverge later (Start might grow a different fill, End might get a special hover state), and having separate files makes those changes localised. The shared style overrides are a deliberate signal that these are passive pass-through nodes; if a third passive shape appears, extract the shared overrides into a helper.
- `TaskShape`'s icon-row construction is a pure function in `icons.ts` that returns a `PIXI.Container`. The shape class is then ~30 lines — just embeds the icons and adds the click handler.
- `renderer.ts` is a thin orchestrator. State resolution, layout, and connection drawing all live in their own files as pure functions; the class owns the maps of shapes and calls them in the right order.
- `index.ts` is the public surface. Internal callers go through the facade, not direct file imports.

### 1.4 Modals — concrete pattern

The old app has 4 modals with identical shells (overlay + dialog frame + title + button row + escape handler). 60–80 lines each, 90% the same markup. Fix it.

The new layout:

```
lib/components/ui/
  Modal.svelte          # overlay + dialog frame + title + escape + close
  ConfirmModal.svelte   # uses Modal, just supplies message + onConfirm
  InputModal.svelte     # uses Modal, just supplies input + onConfirm
  app-modals.svelte     # derives active modal from uiStore, renders once
```

`Modal.svelte` props:

```ts
interface Props {
  show: boolean;
  title: string;
  primaryLabel: string;
  primaryHandler: () => void;
  onClose: () => void;
  children: import('svelte').Snippet;
  primaryStyle?: 'danger' | 'primary';   // for the red vs indigo Confirm vs Input
}
```

Each modal file becomes 15–25 lines: a unique content snippet (a `<p>` for confirm, an `<input>` for input) wrapped in `<Modal>`. No overlay markup, no escape handler, no button row markup.

`app-modals.svelte` derives which modal is active from `uiStore` (a `kind: 'confirm' | 'input' | 'settings' | 'config' | null` field) and renders the matching component. One render, not four.

Settings and Config modals are larger — they keep their own body markup but still use `<Modal>` for the shell (overlay, title, escape).

### 1.5 Side panels — concrete pattern

The old app has 3 panels (`NodeSidePanel`, `ConfigPanel`, `AssistantPanel`) with an identical header markup block (h2 + border-b + px-6 + pt-3 + pb-4). And `right-sidebar.svelte` renders the same `<aside>` twice with different children. Fix both.

```
lib/components/feature/
  PanelHeader.svelte     # the repeated h2 block. 10 lines.
  NodeSidePanel.svelte   # just the form, uses PanelHeader
  ConfigPanel.svelte     # just the body, uses PanelHeader
  AssistantPanel.svelte  # just the chat, uses PanelHeader
  RightSidebar.svelte    # derives active panel, renders ONE <aside>
```

`right-sidebar.svelte` derives the active panel from `uiStore` and `editorStore.selectedNodeId` (e.g. `assistant > config > node`, in that priority), then renders one `<aside transition:fly={…}>` with the chosen component inside. No duplicate markup.

### 1.6 When NOT to abstract

A few things that look like repetition but aren't:

- **Each modal has different primary-button color and label** — that goes in the `<Modal>` props, not a separate `PrimaryButton` component.
- **Each shape has a different icon row** — that's the *whole point* of the shape; don't try to parameterize it.
- **Each panel has different save semantics** (form fields, JSON editor, chat) — keep that logic inside the panel; the abstraction is just the header.

Rule of thumb: if two things differ in **data**, share markup. If they differ in **structure**, copy.

### 1.7 Go bindings (Wails) — concrete pattern

`apps/provar-app`'s Go side mirrors `apps/provar-api` in design, not in shape. The two are different adapters (WebSocket handler vs Wails method) over the same `libs/domain` and `libs/engine`. The mirror is in the conventions — one struct per concern, a stateless base, one file per handler, table-driven registration — not in the wire protocol.

#### What's shared with prover-api (and prover-cli)

- **Same domain code.** `bindings.File.ListTests` and `api.handlers.project.file.list` both call into `libs/domain` for the actual logic. The binding/handler is just an adapter — file walking, YAML parsing, project loading all live in the libs, not in either surface.
- **Same design philosophy.** One struct per concern, embedded base, one file per struct, no central registry of magic strings.
- **Same error wrapping convention.** `fmt.Errorf("list tests: %w", err)` at the call site, errors propagate up.

#### What's Desktop App only

- **Native dialogs** (`bindings.Dialog.SelectProject`) — the Wails runtime gives us `runtime.OpenDirectoryDialog`; the API has no equivalent because it runs server-side.
- **Open external URLs** (`bindings.Shell.OpenExternal`) — the desktop browser launches the URL; the API would just return the string.
- **Window management** (later: app menu, window state) — purely a desktop concern.

The Wails app does NOT mirror the WebSocket protocol. Each binding method is a regular Go function called directly from the JS bridge — no envelope, no meta id, no JSON encode/decode round-trip. That's the right call: Wails handles the marshaling for us.

#### The split

```
internal/bindings/
  base.go         # BaseBinding — ctx + cross-cutting helpers
  file.go         # File — list/read/write/create/delete
  dialog.go       # Dialog — native folder picker (desktop only)
  shell.go        # Shell — open external URLs (desktop only)
  project.go      # Project — open + recent
  config.go       # Config — get/save project + global config
```

`file.go`, `project.go`, `config.go` are the Wails equivalent of `provar-api`'s `handlers/v1/project/file/`, `handlers/v1/project/`, `handlers/v1/project/config/`. Same concern-by-concern split, same one-struct-per-file rule.

`dialog.go` and `shell.go` have no `provar-api` equivalent — they're the desktop-only extras. They still follow the same one-struct-per-file rule for consistency.

Each struct embeds `BaseBinding` for runtime-context access and shared helpers. Each method on a binding is a single concern — no struct grows into a kitchen-sink `Handle*` method.

The old Bun app had 11 RPC commands in `src/bun/commands/`, all sharing a `command` base class. The new layout is the same idea adapted to Wails: one struct per concern, one file per struct, all sharing `BaseBinding`.

#### `BaseBinding` (stateless cross-cutting)

```go
// internal/bindings/base.go
package bindings

import (
    "context"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

// BaseBinding holds the Wails runtime context and provides cross-cutting
// helpers every binding uses. Concrete bindings embed it.
type BaseBinding struct {
    Ctx context.Context
}

// LogErrorf wraps runtime.LogErrorf with a "binding: " prefix.
func (b *BaseBinding) LogErrorf(format string, args ...any) {
    runtime.LogErrorf(b.Ctx, "binding: "+format, args...)
}

// Emit wraps runtime.EventsEmit — used by streaming endpoints later.
func (b *BaseBinding) Emit(name string, data ...any) {
    runtime.EventsEmit(b.Ctx, name, data...)
}
```

`BaseBinding` is stateless beyond the context. Helpers grow only when two or more bindings actually need the same thing — not speculatively.

#### One file per binding

```go
// internal/bindings/file.go
package bindings

import (
    "fmt"
    "os"
    "path/filepath"
    "strings"
)

type File struct {
    BaseBinding
}

func (f *File) ListTests(dir string) ([]string, error) {
    var out []string
    err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
        if err != nil {
            return err
        }
        if d.IsDir() || !strings.HasSuffix(path, ".test.yml") {
            return nil
        }
        rel, _ := filepath.Rel(dir, path)
        out = append(out, rel)
        return nil
    })
    if err != nil {
        return nil, fmt.Errorf("list tests: %w", err)
    }
    return out, nil
}

func (f *File) ReadTestFile(path string) (string, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return "", fmt.Errorf("read test file: %w", err)
    }
    return string(data), nil
}

// WriteTestFile, CreateFile, CreateDirectory, DeletePath follow the
// same pattern — one method, one concern, one error wrap.
```

#### Wiring (in `app.go` and `main.go`)

`App` holds the binding instances and the runtime context. `startup` constructs the bindings. `main.go` registers them all with Wails.

```go
// app.go
type App struct {
    ctx     context.Context
    File    *bindings.File
    Dialog  *bindings.Dialog
    Shell   *bindings.Shell
    Project *bindings.Project
    Config  *bindings.Config
}

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    a.File = &bindings.File{Ctx: ctx}
    a.Dialog = &bindings.Dialog{Ctx: ctx}
    a.Shell = &bindings.Shell{Ctx: ctx}
    a.Project = &bindings.Project{Ctx: ctx}
    a.Config = &bindings.Config{Ctx: ctx}
}
```

```go
// main.go
Bind: []interface{}{
    app.File,
    app.Dialog,
    app.Shell,
    app.Project,
    app.Config,
},
```

The JS namespace is honest: `window.go.main.File.ListTests`, `window.go.main.Dialog.SelectProject`. Each binding is its own concern, no `App.ListTests` indirection.

#### Adding a new binding

New file, new struct, embed `BaseBinding`, add to `App`, add to `Bind`. No central registry to edit, no factory function, no string-key dispatch.

#### When NOT to abstract

A few things that look like repetition but aren't:

- **Each binding has different I/O concerns** (file vs dialog vs shell) — those are the *point* of the binding; don't try to unify them behind a generic `Resource` interface.
- **Error wrapping with a `%w` prefix is per-call** — that goes in the call site (`fmt.Errorf("list tests: %w", err)`), not in `BaseBinding`. The base only provides generic helpers like `LogErrorf`, not per-method error wrappers.
- **Wails emits a "method on a struct" namespace automatically** based on the struct name. Don't add a `Name() string` method to each binding to mimic provar-api's string-key registry. The struct name is the identifier.

---

## 2. Phases

### Phase 1 — Welcome page (done)

Shipped in commit `adb9ce5`. Welcome card layout, no-op buttons, quickstart link, translucent background.

### Phase 2 — Frontend stores + app shell

Add the four Svelte 5 rune stores the rest of the app needs, and wire the layout shell so it can switch between the welcome view and the project view.

- `lib/stores/project-store.svelte.ts` — current project path, file list, refresh
- `lib/stores/editor-store.svelte.ts` — selected file, parsed `TestFile`, selected node, task/compilation states
- `lib/stores/settings-store.svelte.ts` — `~/.provar/settings.json` mirror, first-launch flag
- `lib/stores/ui-store.svelte.ts` — sidebar open/closed, modal kind, active right-panel tab, toast queue
- `App.svelte` shows `<Welcome />` when `!projectStore.path`, otherwise the project shell (toolbar + test explorer + canvas placeholder + right sidebar)
- A single `$effect` in `App.svelte` gates settings load on "no project open"

**Test:** `wails dev` → welcome page renders. Toggle a `path` manually in the dev store → shell layout renders (toolbar + sidebar placeholders + "Select a test" centered placeholder).

### Phase 3 — Go bindings for file IO

Add the Wails-bound methods the frontend will call. No UI changes yet — this is the bridge. Apply the binding pattern from §1.7.

- `internal/bindings/base.go` — `BaseBinding` with ctx + `LogErrorf` / `Emit` helpers
- `internal/bindings/file.go` — `ListTests`, `ReadTestFile`, `WriteTestFile`, `CreateFile`, `CreateDirectory`, `DeletePath`
- `internal/bindings/dialog.go` — `SelectProject` (native folder picker, returns path or null)
- `internal/bindings/shell.go` — `OpenExternal` (opens in default browser)
- `internal/bindings/project.go` — `OpenProject`, `RecentProjects` (read from `~/.provar/settings.json`)
- `app.go` holds the binding instances; `startup` constructs them with the Wails ctx
- `main.go` registers them all via `Bind: []interface{}{app.File, app.Dialog, app.Shell, app.Project}`
- `apps/provar-app/frontend/wailsjs/` regenerates with typed wrappers

**Test:** from the dev console, call `window.go.main.File.ListTests('/some/dir')` and confirm it returns a string array. Call `Dialog.SelectProject()` and confirm a folder picker appears.

**Acceptance:** every method lives in a struct that embeds `BaseBinding`. The JS namespace is the struct name (e.g. `File.ListTests`, not `App.ListTests`).

### Phase 4 — Open project + recent projects

Wire the welcome page buttons to real actions.

- `Welcome.svelte` no longer takes `homeDir` / `recentProjects` as props — reads from `settingsStore` and `projectStore`
- "Open a folder" calls `App.SelectProject()`, then `App.OpenProject(path)`, then sets `projectStore.path`
- "Create sample project" calls `App.CreateSampleProject()` (scaffolds `.provar/` + `tests/`) then opens it
- "Recent projects" section renders from `settingsStore.recentProjects`; clicking one opens it
- Successful open updates `settingsStore.recentProjects` (prepend, dedupe, cap at 10)

**Test:** launch fresh → "Create sample project" creates and opens a project; relaunch → "Recent" shows the prior project. Click "Open a folder" → native picker → choose a project-shaped dir → shell view replaces welcome. Recent list updates immediately.

### Phase 5 — Test explorer (left sidebar)

Port `test-explorer.svelte` (301 lines in the old app).

- Component reads `files`, `selectedFile` from stores; emits select / create / delete intents
- Tree builder from `files: string[]` (pure derived state)
- Folder open/close state local to the component
- Right-click context menu (new test, new folder, delete)
- Search input (filters tree)
- Bottom dock with Settings and AI Assistant buttons (open the right sidebar in the respective tab)
- Wire create/delete to `App.CreateFile` / `App.CreateDirectory` / `App.DeletePath`
- Sidebar slides in/out via `uiStore.isSidebarOpen`; the toggle button is the only thing inside the top drag strip

**Test:** open a project with several `.provar/tests/**/*.test.yml` files → tree renders, folders collapse, files select, right-click creates/deletes, search filters, sidebar toggle works.

### Phase 6 — Editor toolbar + empty canvas

Port `editor-toolbar.svelte` (195 lines) and the "Select a test to begin" empty state.

- Toolbar shows project name, current file path, run button (disabled stub for now), sidebar toggle
- Center placeholder when `editorStore.currentFile` is null
- Both components sit inside the `App.svelte` project-view layout from Phase 2

**Test:** open a project with no test selected → toolbar shows project name, "Select a test to begin" centered. Click a test in the explorer → placeholder still shows (canvas wires up next phase). Click the sidebar toggle in the drag region → sidebar slides.

### Phase 7 — Canvas (graph editor)

Port the `lib/canvas/*` graph renderer (1453 lines across 9 files in the old app), applying the shape design pattern from §1.3.

- File layout per §1.3 — `shapes/{shape,start,end,task,connector}.ts`, `icons.ts`, `state.ts`, `layout.ts`, `connections.ts`, `renderer.ts`, `viewport.ts`, `constants.ts`, `index.ts`
- `Canvas.svelte` becomes a thin wrapper that instantiates `GraphRenderer` and re-renders on store changes
- Replace `editorStore.taskStates`, `runningPathNodeIds`, `compilationStates` with empty stubs (real implementation lands in a later phase)
- Mouse: pan, zoom, select node, drag node, drag-to-connect, double-click to add node
- Selected node id binds back to `editorStore.selectedNodeId`

**Test:** open a project that has a test file with a few actions → nodes render, edges draw, pan/zoom works, click selects, drag moves, double-click on empty space adds a new node, escape clears selection.

**Acceptance:** shapes live under `lib/canvas/shapes/`, one file per shape (named after the class — `start.ts` not `start-shape.ts`). `icons.ts` is a pure function. `renderer.ts` is under 200 lines.

### Phase 8 — Node side panel (edit selected node)

Port `node-side-panel.svelte` (536 lines), applying the panel design pattern from §1.5.

- `PanelHeader.svelte` extracted first; the 3 panels use it (this phase adds node + config, but the header component lands now since both will use it)
- Form fields: action name, description, free-form `data` JSON
- Save → calls `App.WriteTestFile` after updating the parsed `TestFile` and re-serialising
- "Delete node" button
- Re-render canvas on save

**Test:** select a node → panel slides in from the right with current values pre-filled. Edit name → save → canvas re-renders with the new label, file on disk updated. Delete → node removed, panel closes, file on disk updated.

### Phase 9 — Settings + config modals

Port the four modal components and the `AppModals` orchestrator, applying the modal design pattern from §1.4.

- `Modal.svelte` extracted first; all modals use it
- `ConfirmModal.svelte` — generic yes/no, ~20 lines
- `InputModal.svelte` — text input (file/folder name), ~25 lines
- `SettingsModal.svelte` — provider/API key config, reads/writes via `App.GetConfig` / `App.SaveConfig`
- `ConfigModal.svelte` — project-level config (per-project `.provar/config.yml`)
- `app-modals.svelte` — derives active modal from `uiStore.modalKind`, renders once

**Test:** from the test explorer, right-click → "New test" → input modal → enter name → file appears. From toolbar/settings button → settings modal opens, fields editable, save persists, reopen shows saved values.

**Acceptance:** no modal file has its own overlay markup. `app-modals.svelte` is one switch on `uiStore.modalKind`.

### Phase 10 — Setup wizard (first launch)

Port `setup-wizard.svelte` (336 lines). Shown on first run when `~/.provar/settings.json` doesn't exist; takes the place of the welcome view.

- Walks through: provider choice → API key → first project (open existing / create sample / skip)
- On save, writes `settings.json`, hides itself, reveals the regular welcome/empty state
- Lives inside the same `{#if !projectStore.path}` branch as the welcome view, but takes precedence when `settingsStore.showSetupWizard` is true

**Test:** delete `~/.provar/settings.json`, relaunch → wizard appears instead of welcome. Complete it → welcome appears, settings file written. Reopen app → welcome directly.

---

## 3. Out of scope (for this plan)

- AI assistant panel — deferred; the existing `assistant-panel.svelte` is 417 lines with its own chat streaming + markdown parser, and we don't yet have a use case for in-editor AI until the canvas and node editing are stable.
- Debugger / run-from-editor — deferred; depends on the runner integration that's still being settled in the CLI.
- Native menu bar + keyboard shortcuts — deferred; these are nice but not on the critical path.
- Release packaging — deferred; the macOS dev build is the proving ground first.
- Windows / Linux builds — code should be cross-platform-clean, but the packaging target is macOS only.
- Collaborative editing, accounts, cloud sync, telemetry — explicitly excluded by `docs/PRODUCT.md` §2.
