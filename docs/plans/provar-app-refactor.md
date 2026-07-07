# Refactor prover-app: fix the seams, wire libs/domain, add tests

After the initial port (commits `31dc4f7` through `0b6b8d3`), the app builds and the welcome view renders, but a review surfaced real problems: the bindings reinvent `libs/domain` instead of calling it, the frontend parses JSON for files the Go side writes as YAML, the setup wizard collects data it doesn't keep, and there are zero tests. This plan fixes the highest-leverage issues in self-contained, committable phases.

The goal is not a rewrite — the welcome view, the canvas shapes, the modal pattern, the BaseBinding convention are all sound. The goal is to make the seams honest: the GUI shares code with the CLI and the API where it should, the data formats agree end-to-end, and the moving parts are tested.

---

## 0. Key references

Read these before doing anything. They are the rules this plan does not restate.

- **`docs/plans/provar-app-rewrite.md`** — the prior porting plan. §1 (design patterns) still applies. §1.7 (Go bindings) is the convention for adding new bindings.
- **`docs/adrs/005-gui-client-on-wails-svelte-5.md`**, **`006-desktop-app-is-a-peer-of-provar-api.md`**, **`007-gui-bindings-follow-the-base-handler-pattern.md`** — the three ADRs that fix the framework, the peer-not-client architecture, and the one-struct-per-concern binding convention. ADR-006 in particular is the *reason* this refactor exists.
- **`libs/domain/`** — the Go types and functions the bindings should call. Read `project.go`, `settings.go`, `asyncjob.go`. The naming below comes from these files.
- **`.agents/skills/coding/SKILL.md`** — Go style. The most relevant rules for this refactor: doc comments on every exported symbol, no `any` unless designing a generic interface, no empty lines in function bodies, no magic strings or numbers, return early, minimise exports.

## 1. Architectural rules (do not violate)

1. **The GUI shares `libs/domain` with the CLI and the API.** It is a peer surface (ADR-006), not a client of the API. Bindings call `domain.LoadConfig`, `domain.SaveConfig`, `domain.LoadSettings`, `domain.SaveSettings`, `domain.InitProject`, `domain.ParseFile`, `domain.LoadProject` — they do not reimplement these.
2. **The frontend never parses file formats.** It calls a Go binding that returns JSON shaped for the UI. YAML parsing lives in `libs/domain` only.
3. **One struct per binding concern, embedded `BaseBinding` for ctx + helpers (ADR-007).** Adding a binding = one new file in `internal/bindings/` + one new entry in `App` + one new line in `main.go`'s `Bind` list.
4. **Domain types win naming disputes.** If the Go side says `Action`, the TS side calls it `Action` (or `domain.Action`); it does not call it `Node`. The current naming is a port artefact — see Phase 6 for the rename.
5. **No re-implementation of `libs/domain` functions in the bindings.** If a binding looks like `domain.X`, replace the body with a call to `domain.X`.
6. **Settings go through `domain.Settings` end to end.** Both the GUI and the CLI write the same `~/.provar/settings.yml` file in the same format. Hand-rolled YAML in the bindings is a port smell to delete.
7. **Desktop app state is not a domain concern.** The recent-projects list lives in `bindings.History` writing `~/.provar/history.yml`, separate from the user's settings. The domain does not know about it. Mixing them is a layering violation that was introduced during the port. The same principle applies to derived view shapes: the canvas-facing test-file view (`View`/`Graph`/`Node`/`Edge`) is a GUI concern and lives in `apps/provar-app/internal/testfile/`, not in `libs/domain`. The CLI and the API never need it.

## 2. Current state — what the refactor fixes

| # | File | Problem |
|---|---|---|
| 1 | `apps/provar-app/go.mod` | No `replace` directive for `libs/domain`. The build graph has no path from the GUI to the domain. |
| 2 | `internal/bindings/project.go` | Reimplements `~/.provar/settings.yml` with hand-rolled YAML (`"recentProjects:\n  - %s\n"`). Duplicates the `settingsDir`/`settingsFilename` constants from `libs/domain/settings.go:24-27`. `Home()` discards the error and returns `""` as a fallback. The recent-projects hand-rolled YAML does not belong in this file at all — it's app state, not a domain concern. |
| 3 | `internal/bindings/config.go` | Reimplements `LoadConfig`/`SaveConfig` from `libs/domain/project.go:380-419`. Returns `map[string]any` instead of using the domain's `projectConfig`. |
| 4 | `internal/bindings/file.go` | `ListTests` walks the directory every time. The domain has `LoadProject` which returns `Files` already populated. Magic string `".test.yml"` at line 24. |
| 5 | `frontend/src/lib/components/TestExplorer.svelte:71` | `JSON.parse(content) as TestFile` — but the Go side writes YAML. Reading a real test file fails. |
| 6 | `frontend/src/lib/components/SetupWizard.svelte:73-99` | Collects provider + API key, advances step, never persists. The "next" button on step 2 is a no-op for storage. |
| 7 | `frontend/src/lib/components/Welcome.svelte:38-46` | "Create sample project" button calls `onError("Coming soon…")`. The domain has `InitProject(target, useSample, force)` for exactly this. |
| 8 | `frontend/src/lib/types.ts` | Stub interfaces invented in this app, not derived from `libs/domain`. The shape will drift. |
| 9 | All bindings | Zero test coverage. |
| 10 | `frontend/src/lib/stores/settings-store.svelte.ts:25` | `showSetupWizard` is set true when `recentProjects.length === 0`. This fires every time the user clears their recent list, not just first launch. |
| 11 | `apps/provar-app/app.go:37-43` | Six near-identical lines wiring the same ctx to six fields. Add-a-binding cost is three new lines in three places. Phase 2 adds a seventh (the `History` binding). |
| 12 | `frontend/src/lib/components/Canvas.svelte`, `Toolbar.svelte`, `TestExplorer.svelte`, `RightSidebar.svelte` | Magic offsets (`pt-[36px]`, `pt-[64px]`, `h-[56px]`) for "below the drag region" / "below the toolbar". If the toolbar height changes, three components break. |

The following are noted but **not** in this refactor's scope (called out so the agent doesn't expand into them):

- AI assistant panel and debugger — deferred per the existing plan.
- Native menu bar and packaged release — deferred.
- The canvas layout magic numbers (`60`, `90`, `30`) — clean up when the canvas is touched for other reasons, not now.
- Tailwind theme tokens for the surface colours — bundle with the offset cleanup, not separately.
- Renaming `TestNode` → `Action` and `NodeShape` → `ActionShape` in the canvas — Phase 6 of this plan, after the binding wiring is done.

## 3. Phases

Phases are sequenced. Each is a single commit with a passing build and (where applicable) tests. Don't reorder.

### Phase 1 — Wire `libs/domain` into the build graph

Establish the path from the GUI to the domain. **No behavior change yet** — this phase just makes the import work.

**Files**

- `apps/provar-app/go.mod` — add a `replace github.com/thani-sh/provar => ../..` directive. The monorepo is one Go module, so the replace targets the parent. Add `require github.com/thani-sh/provar v0.0.0` and let `go mod tidy` resolve the indirect.
- `internal/bindings/wire_test.go` — smoke test that imports `domain.ProviderOpenAI` and asserts the path resolves. This is the canonical proof that Phase 1 succeeded. Subsumed by the table-driven tests in Phase 5.

**Acceptance**

- `go build ./...` from `apps/provar-app/` succeeds.
- `go mod tidy` is a no-op after the first run.
- A binding can `import "github.com/thani-sh/provar/libs/domain"` without a "no required module" error.
- The wire test passes.

### Phase 2 — Replace reimplemented bindings with domain calls; split recent projects to a separate file

Delete the duplicated logic in `project.go` and `config.go`. Have them call `libs/domain` instead. **Each binding method that does I/O now becomes a one-liner over a domain function.** And: the recent-projects list is desktop app state, not a domain concept. It moves out of `domain.Settings` and into a new `bindings.History` writing `~/.provar/history.yml`.

**Why the split.** Settings are stable user preferences (provider, API key, model) that change rarely. The recent-projects list is dynamic state that changes on every project open. Two different lifecycles, two different files. The old hand-rolled `recentProjects:` line in `settings.yml` was conflating them; the new code does not. The domain does not know about recent projects.

**Files**

- `internal/bindings/history.go` *(new)*: the `History` struct, embedding `BaseBinding`. Three methods:
  - `Recent() ([]string, error)` — read `~/.provar/history.yml`. Returns `[]string{}` (not an error) when the file is missing; returns an error only on real I/O or parse failures. The app must boot cleanly on a fresh machine.
  - `Add(path string) error` — load, dedupe, prepend, cap at 10 entries, write back. Creates the file (and the parent dir) if missing.
  - `Exists() (bool, error)` — for first-launch detection. Returns `true` if the file is present, `false` if not. Replaces the old "is `recentProjects` empty?" check, which incorrectly fired every time the user cleared their history.
  - Constants at the top of the file: `provarDir = ".provar"`, `historyFilename = "history.yml"`, `historyCap = 10`, plus the standard `dirPerm`/`filePerm`. No magic strings or numbers in function bodies.
  - File format: `recent: [list of paths]`. Wrapped under a `recent:` key so we can add more sections later without a migration. Top-level list would also work but is fragile.
- `internal/bindings/project.go`:
  - Delete the `settingsDir`/`settingsFilename` constants — they live in `domain`.
  - Delete the hand-rolled YAML for recent projects. The recent-projects logic moves to `History`.
  - `Home` becomes `(string, error)` and returns `os.UserHomeDir()` directly. The skill: no silent fallbacks.
  - Add `Settings() (*domain.Settings, error)` — call `domain.LoadSettings`. The frontend uses this to drive the settings modal.
  - Add `SaveSettings(s *domain.Settings) error` — call `domain.SaveSettings`.
  - The `RecentProjects` and `AddRecent` methods are removed from this binding. They live on `History` now.
- `internal/bindings/config.go`:
  - `LoadConfig` calls `domain.LoadConfig(projectRoot)`.
  - `SaveConfig` calls `domain.SaveConfig(projectRoot, cfg)`. Adjust the signature to match (the domain's signature is the source of truth).
  - Delete the `configPath` helper.
- `internal/bindings/file.go`:
  - Add a `LoadProject(path string) (*domain.Project, error)` method that calls `domain.LoadProject(path)`. The frontend uses this to get the project's `Files` and `Browser` config without re-walking the directory.
  - Keep `ListTests` for now but add a constant `testFileExt = ".test.yml"` and use it.
- `apps/provar-app/app.go`:
  - Add `History *bindings.History` to the `App` struct.
  - Allocate it in `NewApp`; wire its ctx in `startup`.
- `apps/provar-app/main.go`:
  - Add `app.History` to the `Bind: []interface{}{…}` list.
- **Frontend** (also part of this phase — the recent-projects split is a single architectural change that touches both sides):
  - `lib/stores/history-store.svelte.ts` *(new)*: `recent = $state<string[]>([])`, `loaded = $state(false)`. `load()` calls `History.Recent()` and never throws — if the binding errors, log it and keep the empty list. `add(path)` is optimistic: update the in-memory list first, then call `History.Add(path)`; on error, revert and re-throw. Capped at 10 in memory, matching the on-disk cap.
  - `lib/stores/settings-store.svelte.ts`: delete `recentProjects`, `prependRecent`. Replace the `showSetupWizard` first-launch trigger with a `History.Exists()` call inside the gated `$effect`. The store still owns `homeDir`, `showSetupWizard`, `hasCheckedSetup`.
  - `lib/stores/project-store.svelte.ts`: in `openProject`, call `History.Add(path)` instead of `Project.AddRecent(path)`.
  - `App.svelte`: call `historyStore.load()` in the gated `$effect` alongside `settingsStore.load()`. The welcome view's `onOpen` no longer needs to call `settingsStore.prependRecent` — the store does it.
  - `Welcome.svelte`: read `historyStore.recent` directly (or accept it via a prop). The `onOpen` prop stays for the welcome button → `projectStore.openProject` flow.

**Acceptance**

- `go build ./...` succeeds.
- `go vet ./...` is clean.
- `bindings/project.go` and `bindings/config.go` contain no `os.ReadFile`, `os.WriteFile`, `yaml.Marshal`, or string-concatenated YAML. They delegate to `libs/domain`.
- A grep for `recentProjects:` in `internal/bindings/` returns zero hits.
- `bindings/history.go` exists and is the only place that touches `~/.provar/history.yml`.
- `domain.Settings` does not have a `RecentProjects` field. Grep the domain to confirm.
- `bun run check` and `bun run build` pass.
- The frontend `historyStore.load()` does not throw when the file is missing. The first launch — no `settings.yml`, no `history.yml` — boots cleanly into the setup wizard.
- `showSetupWizard` is `true` when `History.Exists()` is `false`; it does not flicker on/off based on the contents of the recent-projects list.
- The `wire_test.go` smoke test from Phase 1 still passes.

### Phase 3 — Fix the JSON/YAML mismatch (frontend reads through a binding)

The frontend should never parse a test file. It calls a Go binding that returns the parsed file as a JSON shape the UI can use.

**Files**

- `apps/provar-app/internal/testfile/testfile.go` *(new package, ~80 lines)*: the canvas-facing view of a test file. Contains the `View`/`Graph`/`Node`/`Edge` types and `FromActions` / `ToActions` conversions. **Lives in the desktop app, not in `libs/domain` — the view shape is a GUI concern; the CLI and the API don't need it.** This is the same principle as the recent-projects split: a desktop-app concern should not leak into the domain.
  - The conversion adds implicit position edges (action N → action N+1) when the action has no explicit `Next` and a successor exists. These edges are marked `Implicit: true` in the JSON. The inverse drops them. Without the marker, a round-trip would silently rewrite hand-written YAML to add explicit `next` fields — confusing for users.
  - `Order` is a parallel array of action ids in the source order. The canvas ignores it; the inverse uses it to preserve the source ordering on round-trip.
- `internal/bindings/file.go`:
  - `ReadTestFile(projectDir, relPath)` now returns `*testfile.View`, not a string. Internally it calls `domain.ParseFile` then `testfile.FromActions`.
  - `WriteTestFile(projectDir, relPath, view)` converts the view back via `testfile.ToActions` and calls `domain.SaveFile`.
- `apps/provar-app/internal/testfile/testfile_test.go` *(new)*: round-trip tests for both a linear chain (no explicit `Next`) and a DAG with branching. Catches the implicit-edge-as-explicit round-trip bug.
- `frontend/src/lib/components/TestExplorer.svelte`: drop the `JSON.parse` (line 71). The binding now returns the parsed object directly. Wrap it in the local `TestFile` type with the editor-only `code` field.

**Acceptance**

- Opening a real `.provar/tests/**/*.test.yml` file in the GUI parses without error.
- `TestExplorer.svelte` has no `JSON.parse` call.
- A linear chain with no explicit `Next` round-trips byte-stable: `b.Next` is empty on the way back, not `[c]`.
- A DAG with explicit `Next` preserves the explicit edges on round-trip.
- `libs/domain` does not import or know about `testfile`. Grep the domain to confirm.

### Phase 4 — Setup wizard persists, sample project works

`SetupWizard` collects data and loses it. `Welcome` advertises "Create sample project" and does nothing. Both should go through `libs/domain`.

**Files**

- `frontend/src/lib/components/SetupWizard.svelte`:
  - On the "API key" step's Next: call `Project.SaveSettings({provider, providers: {…}})` with the key wired into the right provider's `APIKey` field.
  - On the "First project" step's "Open a folder" button: call `Dialog.SelectProject`, then `Project.LoadProject` (the new binding from Phase 2), then `projectStore.openProject`. Then dismiss.
  - On "Skip for now": just dismiss. (The user can fill in settings later via the settings modal.)
- `frontend/src/lib/components/Welcome.svelte:38-46`:
  - Replace the no-op with a real call. The button takes a target dir (`Dialog.SelectProject` again, or a "save into default location" choice), then calls `Project.CreateSampleProject(target)`. The new binding wraps `domain.InitProject(target, useSample=true, force=false)`.
- `internal/bindings/project.go`: add `CreateSampleProject(target string) error` wrapping `domain.InitProject`.

**Acceptance**

- Running through the wizard end-to-end writes a valid `~/.provar/settings.yml` that `domain.LoadSettings` can re-read.
- "Create sample project" on the welcome view creates a real project and opens it.
- `setupStore.showSetupWizard` does not fire on subsequent launches (rely on the file's existence, not on `recentProjects.length === 0`). **Done in Phase 2:** the first-launch trigger is `History.Exists()`, not list length, so the wizard does not flicker on/off as the user clears their history.

### Phase 5 — Add tests

The bindings are pure functions over `os` and `domain`. They test in five lines each.

**Files**

- `internal/bindings/file_test.go`: `ListTests` (filters by `.test.yml` extension, recurses into subdirs, error on non-existent root), `CreateFile`, `CreateDirectory`, `DeletePath` (recursive), `ReadTestFile` / `WriteTestFile` round-trip through the `testfile.View` shape, error cases for missing files and nil views.
- `internal/bindings/history_test.go`: `Recent` returns empty list (not an error) on first launch, `Add` prepends and dedupes, caps at 10, persists in the expected YAML format. Error on malformed YAML. `Exists` returns true after first add.
- `internal/bindings/project_test.go`: `Settings` returns domain defaults when the file is missing, `Settings` / `SaveSettings` round-trip preserves provider + key, `Home` returns `$HOME`, `CreateSampleProject` scaffolds the sample and rejects a second call on the same target.
- `internal/bindings/config_test.go`: `LoadConfig` returns empty when missing, `SaveConfig` / `LoadConfig` round-trip preserves nested maps.
- `internal/testfile/testfile_test.go` *(already in place from Phase 3)*: linear chain, DAG with explicit `Next`, round-trip preserves order, the `Implicit` marker keeps implicit position edges out of the inverse.
- `internal/bindings/dialog_test.go` and `shell_test.go`: skip — `Dialog.SelectProject` and `Shell.OpenExternal` call `runtime.OpenDirectoryDialog` / `runtime.BrowserOpenURL` which need a Wails runtime. Exercised via `wails dev`. The plan called this out.
- `BaseBinding.LogErrorf` and `BaseBinding.Emit` are similarly Wails-runtime-only. They are 0% covered, but every concrete binding struct embeds `BaseBinding` and the Wails-generated bindings expose them. They round-trip correctly in `wails dev`; unit-testing them requires mocking `runtime.LogErrorf`, which is not worth the indirection for two one-liners.

**Acceptance**

- `go test ./...` from `apps/provar-app/` passes.
- Coverage of `internal/bindings/` is ≥ 80% (lines). **Done: 80.9%.** The remaining ~19% is the Wails-runtime-only methods (BaseBinding helpers, Dialog, Shell) — those are exercised by `wails dev` instead.
- Coverage of `internal/testfile/` is ≥ 80% (lines). **Done: 87.5%.**
- `internal/bindings/wire_test.go` (the Phase 1 smoke test) is subsumed by these — but kept around as a small sentinel that the `libs/domain` import is reachable. Cheap to maintain.

### Phase 6 — Naming alignment (the canvas)

This is the rename the §1.3 plan implicitly punted on. The Go side says `domain.Action`. The canvas says `TaskShape` / `TestNode`. Make them agree.

**Files**

- `frontend/src/lib/types.ts`:
  - Replace `TestNode` with `Action` (matches `domain.Action`).
  - Replace `TestFile` with a view type that has `graph: { start, nodes: Record<string, Action>, edges }`.
  - Replace `TestGraph` with `ActionGraph` (or just inline its fields into `TestFile`).
- `frontend/src/lib/canvas/shapes/task.ts` and the file name:
  - Rename `task.ts` → `action.ts`. `TaskShape` → `ActionShape`.
  - Update `renderer.ts` and the test explorer's `selectFile` to match.
- `frontend/src/lib/canvas/constants.ts`:
  - `GRAPH_START_ID` is fine — it's a string constant, not a type.
  - Add `ACTION_MIN_WIDTH`, `ACTION_PADDING_X` (etc.) if any magic numbers from the shape get promoted to layout constants during this work.

**Acceptance**

- Grep for `TestNode` in `frontend/src` returns zero hits.
- Grep for `TaskShape` in `frontend/src/lib/canvas` returns zero hits.
- `svelte-check` and `bun run build` pass.

### Phase 7 — Polish

The smaller items. Bundle them; do not give each its own phase.

**Files**

- `apps/provar-app/app.go:37-43` — replace the six-line `startup` with a loop over `[]*bindings.BaseBinding{a.File, a.Dialog, a.Shell, a.Project, a.Config}`. Same for `NewApp` (collect the list once, construct from it).
- `frontend/src/App.svelte` — same. The `pickProject` function in `App.svelte:21-30` is dead code (the welcome page handles its own clicks). Delete it.
- `frontend/src/lib/stores/settings-store.svelte.ts:25` — first-launch detection should check for `~/.provar/settings.yml` existence via a new `Project.SettingsExist()` binding, not `recentProjects.length === 0`.
- `frontend/src/lib/components/Modal.svelte:31` — `svelte:window onkeydown={handleKey}` runs a global listener on every mount. Move the listener to a `{@attach}` on the outer div, or only mount it when `show` is true.
- `frontend/src/lib/components/Canvas.svelte`, `Toolbar.svelte`, `TestExplorer.svelte`, `RightSidebar.svelte`, `App.svelte` — replace the magic `pt-[36px]` / `pt-[64px]` / `h-[56px]` with CSS custom properties on `:root` in `style.css`:
  - `--drag-region-height: 56px;`
  - `--toolbar-height: 36px;` (the part of the toolbar below the drag region)
  - Components read them via `style="padding-top: var(--toolbar-height)"` or `h-[calc(var(--drag-region-height)+var(--toolbar-height))]`.
- `frontend/src/lib/components/SetupWizard.svelte`, `NodeSidePanel.svelte` — strip the redundant body-section comments (`// Provider buttons`, `// API key field`, etc.). The code is self-explanatory.

**Acceptance**

- `svelte-check` and `bun run build` pass.
- `go build ./...` and `go vet ./...` pass.
- `go test ./...` passes.

## 4. Don't do this

These are decisions already made. Don't relitigate them; the ADRs are the answer.

- Don't add a `Settings` field to the bindings struct so the frontend can read settings in one call. Use `domain.Settings` from `libs/domain/settings.go`.
- Don't add a `Compile` / `Run` binding. Those are deferred phases.
- Don't rename `BaseBinding.Ctx` to private + a getter. The pattern is documented in ADR-007; the public field is fine.
- Don't introduce a new npm package for state management. The runes in `$state` are sufficient.
- Don't add a CSS-in-JS solution or extract Tailwind into a custom system. The existing tokens stay.
- Don't move the bindings into `internal/wails` or any other rename. They're `internal/bindings` per ADR-007.
- Don't add an `App.ListTests` indirection. The namespace is the struct name.

## 5. Verification at the end of every phase

Run from `apps/provar-app/`:

```bash
go fmt ./... && go vet ./... && go build ./... && go test ./...
```

From `apps/provar-app/frontend/`:

```bash
bun run check && bun run build
```

Both must pass before a phase is committed. The commit message follows the existing pattern (`feat: …`, `fix: …`, `chore: …`, lowercase, no scope).

## 6. Phasing summary

| # | Phase | Effort | Risk |
|---|---|---|---|
| 1 | Wire `libs/domain` into the build graph | low | low |
| 2 | Replace reimplemented bindings with domain calls; split recent projects to history file | medium | medium (touches settings + history YAML formats, adds a new binding, refactors frontend stores) |
| 3 | Fix the JSON/YAML mismatch (frontend reads through a binding) | medium | medium (new internal/testfile package, plus an Implicit marker on synthesised edges to keep round-trips byte-stable) |
| 4 | Setup wizard persists, sample project works | medium | low |
| 5 | Add tests | medium | low (skip the Wails-runtime-only methods; mock-free unit tests hit 80.9% on bindings and 87.5% on testfile) |
| 6 | Naming alignment (canvas) | medium | medium (rename touches many files) |
| 7 | Polish | low | low |

Phases 1–4 are correctness — they have to land. Phases 5–7 are quality — do them but they're not blocking the app from working.

End of plan.
