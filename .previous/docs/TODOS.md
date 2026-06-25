# TODOS


### T016: drop the (cfg as any).baseUrl cast in provar-cli compile
> importance: high
> affected areas: apps/provar-cli, libs/domain

#### Problem
`apps/provar-cli/src/commands/compile/index.ts:70` accesses `cfg.baseUrl` via `(cfg as any)`. `googleProviderSchema` does not declare a `baseUrl` field. The cast hides a real Zod-schema-vs-actual-field mismatch. If the schema is later updated to add `baseUrl` correctly, the cast means the type system does not help the consumer. Verified by audit (CLI-3, H-7).

#### Solution
Either add `baseUrl` to the schema, or switch `modelSettingsSchema` to `z.discriminatedUnion("provider", [...])` so `cfg.baseUrl` is only on the OpenAI branch. Remove the cast.

---

### T017: decide what to do with the dead MutationTrackingPage and its underlying monkey-patch
> importance: high
> affected areas: libs/engine

#### Problem
`MutationTrackingPage` was supposed to replace the page-mutation monkey-patch. The class is now dead (re-exported but no callers — Lib-1, App-4). The underlying monkey-patch is STILL in `test-run.ts:143-170` and `compiler/generator.ts:247-275`. The class docstring claims the bug is fixed. The "fix" is a lie. Verified by audit (App-4, H-1). Note: the audit rejected the producer's specific sub-claim that `generator.ts:326` skips restore on `page.content()` failure — the catch block at 340-345 does restore. The broader claim (monkey-patch still in place) is correct.

#### Solution
Either delete the dead class and the dead comment, or wire the class up and remove the monkey-patches. If removing the monkey-patch, introduce a small private `tracker.ts` in `libs/engine/src/runtime/` that takes the `Page` once and returns a typed `MutationTracker`. Centralize `MUTATING_METHODS` in this single source of truth. (See `refactor-libs.md` Phase 2.3 and Phase 6.2.)

---

### T018: make registerRPCHandlers duplicate-safe
> importance: high
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/mainview/lib/api/rpc.ts:8-51` exposes a module-level `handlers: Handlers = {}` and `Object.assign(handlers, newHandlers)` (last-write-wins). Both `project-store.svelte.ts:14-24` (constructor) and `App.svelte:57-74` (onMount) call `registerRPCHandlers`. The current key sets do not overlap, so the bug is latent — but a future maintainer who adds `settingsChanged` to `project-store` will see handlers silently disappear. Verified by audit (App-7, H-4).

#### Solution
Use a `Map<key, Set<handler>>` with duplicate-throw, or pick one site (e.g. `App.svelte` onMount) to do the registration. HMR re-runs `onMount` so the current pattern is fragile even today.

---

### T019: rename stale "graph / task / run" terminology in the canvas layer
> importance: high
> affected areas: apps/provar-app

#### Problem
The 45742af commit replaced "workspace" with "project" cleanly. But user-facing identifiers in the canvas layer (`task-shape.ts`, `graph-renderer.ts`, `node-shape.ts`, `infinite-canvas.ts`), the `utils/graph.ts` filename, and function names like `runAllPaths`, `runTestPathStream`, `GRAPH_START_ID` still use the old vocabulary. A user reading the code sees "graph" and "task" everywhere while the public docs say "project" and "step" — they think the rename is incomplete. The canonical types `Task` / `Graph` / `Path` / `File` are intentional and should NOT be renamed. Verified by audit (App-8, H-5, T-4).

#### Solution
Rename the canvas-internal helpers (not the type names) to project-step vocabulary: `graph-renderer.ts → project-renderer.ts`, `GRAPH_START_ID → START_ID`, `runAllPaths → executeAllPaths`, `runningPathNodeIds → activePathStepIds`, `utils/graph.ts → utils/path-enumeration.ts`. Clean up JSDoc comments in `libs/domain/src/index.ts` that confuse "step" with "task". (See `refactor-libs.md` "out of scope" note on type renaming.)

---

### T020: fix file-switch screenshot leaks in the M-5 audit finding
> importance: high
> affected areas: apps/provar-app

#### Problem
Same defect class as T010 but separately scoped for clarity: the `loadScreenshotsForNode` race lets previous file's screenshots attach to the new file's node IDs on file switch. Promoted from Medium to High by the audit (H-13). Already addressed in T010.

#### Solution
Subsumed by T010.

---

### T024: discard the dead `$components` alias and fix the misleading ssr comment in prover-web
> importance: medium
> affected areas: apps/provar-web

#### Problem
`svelte.config.js:18-20` declares `alias: { $components: ... }` pointing at a directory that does not exist. `+layout.ts:4` has `export const ssr = true` with a misleading comment — for a static site you want `csr = false` to strip client-side hydration, not `ssr = true`. (See `refactor-other-apps.md` Phase 3.6 and 3.7.)

#### Solution
Remove the `$components` alias. Fix the `+layout.ts` comment and decide whether the site needs SSR/CSR/hydration; pick the right flag.

---

### T025: add 1x/2x screenshot variants and enable precompress in prover-web
> importance: medium
> affected areas: apps/provar-web

#### Problem
The hero screenshot is a single 3644×2370 PNG (~171 KB LCP image). Slow on 3G. `svelte.config.js:12` has `precompress: false` (or unset), so `.br` and `.gz` siblings are not emitted. No `srcset` / `sizes` on the `<img>` tag. Promoted from Low to Medium by the audit (Web-6, Web-7).

#### Solution
Generate `screenshot-1x.png` (≈1822×1185) and `screenshot-2x.png` (current 3644×2370) into `apps/provar-web/static/`. Add `srcset` and `sizes` so narrow viewports get the smaller version. Keep `loading="eager"` (it's the LCP element). Set `precompress: true` in `svelte.config.js`. (See `refactor-other-apps.md` Phase 3.9-3.10.)

---

### T026: stream per-node progress from compileProgress in the CLI
> importance: medium
> affected areas: apps/provar-cli, libs/engine

#### Problem
`apps/provar-cli/src/commands/compile/index.ts:73-91` calls `compile({...})` and discards the `compileProgress` events. The user sees no per-node progress for a 30+ second compile. The `compileProgress` generator yields `compile-started`, `node-started`, `node-succeeded`/`node-failed`, and `compile-finished` — sufficient for a progress bar (G-5 in the audit confirms). Verified by audit (CLI-2, App-13).

#### Solution
Switch from `compile({...})` to `for await (const event of compileProgress({...}))` and log each `node-started` (cyan), `node-succeeded` (green ✓), `node-failed` (red ✖). On `compile-finished`, capture `result` and apply the existing successCount / exit-code logic. (See `refactor-other-apps.md` Phase 4.4.)

---

### T027: dedupe findFilesByExtension with loadProject and skip node_modules
> importance: medium
> affected areas: apps/provar-cli, libs/engine

#### Problem
`apps/provar-cli/src/commands/run/index.ts:48` uses `findFilesByExtension` which duplicates `loadProject`'s walk. The hand-rolled walk does not skip `node_modules`, so on a monorepo run it would scan the entire dependency tree. Verified by audit (CLI-4, CLI-8, Missed-4).

#### Solution
Replace with `loadProject(resolvedPath)` and derive `filesToRun` as `project.files.map(f => f.path.replace(".test.yml", ".test.ts"))`. Delete `apps/provar-cli/src/utils/fs.ts` once `findFilesByExtension` has no callers. (See `refactor-other-apps.md` Phase 5.3.)

---

### T028: extract a shared parseArgs helper for the CLI
> importance: medium
> affected areas: apps/provar-cli

#### Problem
`apps/provar-cli/src/commands/compile/index.ts:23-27` and `run/index.ts:24-32` hand-roll positional-arg sweeps. Missed-5 from the audit: unknown flags are silently ignored. CLI-11's which-order analysis was reversed by the audit (the bug is real, the prose about which form is right is flipped), but the underlying issue is that there's no shared parser.

#### Solution
Create `apps/provar-cli/src/utils/args.ts` exporting `parseArgs(args, knownFlags): { target, flags }`. Add an unknown-flag warning. Use it in both `compile` and `run`. (See `refactor-other-apps.md` Phase 5.1-5.2.)

---

### T029: fix the no-debounce generateDiff out-of-order resolution race
> importance: medium
> affected areas: apps/provar-app

#### Problem
`node-side-panel.svelte:46-124` runs `generateDiff` (async, ~100ms+ for 1920×1080 PNG) inside a `$effect` that fires on every change of `baseline` or `current`. The slowest resolution can overwrite the most recent diff. No debounce, no AbortController, no run-id guard. The audit caught the out-of-order resolution aspect of App-19 (M-4).

#### Solution
Add a debounce (~100ms), an AbortController to cancel in-flight diffs, or a run-id guard that drops stale results. Subsumed partially by T004 (the per-keystroke writeFile debounce); the diff race needs its own debounce in the panel.

---

### T030: add error handling to loadFile (no try/catch around ProvarAPI.readFile)
> importance: medium
> affected areas: apps/provar-app

#### Problem
`editor-store.svelte.ts:363-376` `loadFile` does `const res = await ProvarAPI.readFile(path);` with no try/catch. If `readFile` throws (file deleted between list and load, permission denied, Zod parse failure), the exception propagates to `App.svelte:465` which has no try/catch. The webview console shows the error; the user sees no message; the file list still shows the file (no `refreshFiles` called on error). Verified by audit (M-10).

#### Solution
Wrap the `readFile` call in try/catch; on failure, call `refreshFiles()` to resync the file list and surface a user-visible error.

---

### T031: dedupe concurrent loadScreenshotsForNode calls per node
> importance: medium
> affected areas: apps/provar-app

#### Problem
`loadScreenshotsForNode` is called from `runStream` `task-finished`, `task-failed`, `visual-comparison-triggered`, and `loadFile`. For a 50-task run, each task fires 3+ calls. Each call does a fresh `getScreenshots` IPC, reads the PNG from disk, and base64-encodes. For 50 nodes × 3 calls × 3MB = 450MB per run. Verified by audit (M-12).

#### Solution
Dedupe in-flight `loadScreenshotsForNode` calls per node — keep a `Map<nodeId, Promise<Screenshots>>` and return the same promise for concurrent calls.

---

### T032: remove the dead re-export and dead MUTATING_METHODS in @libs/domain
> importance: medium
> affected areas: libs/domain, libs/engine

#### Problem
`libs/domain/package.json:6-8` has a `"."` entry that re-exports `libs/domain/src/index.ts` — but no consumer imports from `@libs/domain` (only `@libs/domain/zod` is used). Verified by audit (Lib-15). The `MUTATING_METHODS` const is triplicated between `test-run.ts`, `compiler/generator.ts`, and the dead class (Lib-17).

#### Solution
Delete the `"."` entry in `libs/domain/package.json` and `libs/domain/src/index.ts`. Verify no consumer imports from `@libs/domain`. Centralize `MUTATING_METHODS` in the new `libs/engine/src/runtime/tracker.ts` (per T017). (See `refactor-libs.md` Phase 2.7 and 6.2.)

---

### T033: replace the as any cluster in libs/engine and libs/models
> importance: medium
> affected areas: libs/engine, libs/models

#### Problem
10 `as any` / `as unknown as` casts in libs. Specific sites: `loader.ts:240`, `generator.ts:62, 218-227, 298, 404-481`, `test-run.ts:174`, `compiler.ts:171, 237`, `sandbox.ts:131`, `models/tools.ts:19`. Verified by audit (Lib-8).

#### Solution
- Change `configSchema.variables` to a proper union (T011).
- Add a `toModelMessage(msg: LLMMessage): ModelMessage` mapper in `libs/models/src/client/index.ts`; remove the inline `as "user" | "assistant" | "system"` cast.
- Make `CommandInterface` generic (`<TInput, TOutput>`) and forward `TInput` through `convertCommandToTool`.
- Expose `getActivePage()` (or a `page: Page | null` getter) on `PathRunner`; replace the `sandbox.ts:131` cast.
- Replace the hand-rolled `new SelfHealingLoop<...>` with `runSelfHealingLoop` from `@thani-sh/duct-tape` (if the signature matches).
- (See `refactor-libs.md` Phase 4.)

---

### T035: clean up post-rename stragglers (utils/graph.ts filename, stale JSDoc)
> importance: medium
> affected areas: apps/provar-app, libs/domain

#### Problem
`apps/provar-app/src/mainview/lib/utils/graph.ts` filename is itself a straggler from the pre-rename era. JSDoc comments in `libs/domain/src/index.ts` call `Task` a "step" — terminology drift in the libs. The audit caught several small instances (M-2, cross-cutting Medium).

#### Solution
Rename `utils/graph.ts` to `utils/path-enumeration.ts` (or similar). Update JSDoc in `libs/domain/src/index.ts` to use the canonical `Task` / `Graph` / `Path` / `File` names.

---

### T036: add unit tests across all four libs
> importance: medium
> affected areas: libs/config, libs/domain, libs/engine, libs/models

#### Problem
None of the 4 libs have any unit tests. The audit confirmed this (Lib-18). The refactors in T011, T013, T017, T032, T033 all benefit from a test net.

#### Solution
- `libs/config/src/storage.test.ts` — `deepMerge` matrix; `loadSettings` (missing file, valid file, truncated file → backup + throw); `saveSettings` round-trip.
- `libs/domain/src/zod.test.ts` — round-trip YAML → `TestFile`.
- `libs/engine/src/loader.test.ts` — `buildGraphPaths` (linear, diamond, cycle, missing-node); `parseTestFile` (valid, invalid, hash mismatch); `resolveEnvVars`.
- `libs/engine/src/compiler/generator.test.ts` — `groundAndGenerateTask` happy-path; executor's stateful fast-path error mapping.
- `libs/engine/src/runtime/tracker.test.ts` — proxy method invocation, dispose behavior, dispose-after-call throws.
- `libs/models/src/client/index.ts` test — `mapAttachment` for text, code, image, unsupported type.
- Wire `bun test` in each lib's `package.json` and a top-level runner. (See `refactor-libs.md` Phase 5.)

---

### T038: surface the auto-compile progress spinner state in the canvas
> importance: medium
> affected areas: apps/provar-app

#### Problem
`bun/rpc/streams.ts:130-153` synchronously calls `compileProgress` (LLM round-trip) before yielding any event to the webview. The user sees the spinner with no progress. Verified by audit (App-13).

#### Solution
Surface `compileProgress` events through the existing stream consumer. The events are sufficient for a progress bar (G-5 confirms `compileProgress` yields 2+2N events for an N-task file). No new event type needed.

---

### T039: drop the schemaForLoadedFileMeta schema and the SettingsSchema alias
> importance: medium
> affected areas: libs/domain, libs/config

#### Problem
`libs/domain/src/zod.ts:168-174` defines `schemaForLoadedFileMeta` which is a dead export. `SettingsSchema` is an alias that is unused (Lib-19 area, M-5/M-6 from the audit).

#### Solution
Delete `schemaForLoadedFileMeta` (or replace with `z.custom<Task | Graph | File>()` identity comparison per the b1bffe0 fix design). Delete the `SettingsSchema` alias. (See `refactor-libs.md` Phase 6.1.)

---

### T040: remove the dead cleanCode export from libs/engine
> importance: medium
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/generator.ts:27-34` exports `cleanCode`. The local `cleanCode` variable in `sandbox.ts:44` shadows it. Verified by audit (Lib-13).

#### Solution
Delete the `cleanCode` export. Rename the local variable in `sandbox.ts:44` to `stripped` to avoid shadowing. (See `refactor-libs.md` Phase 2.6.)

---

### T042: convert sync fs calls in libs/engine loader to fs/promises
> importance: medium
> affected areas: libs/engine

#### Problem
`libs/engine/src/loader.ts:220, 237, 247-260` uses sync `fs` calls inside an async `loadProject`. The recursive `scan(dir)` cannot be cancelled. Verified by audit (Lib-11).

#### Solution
Convert to `fs/promises` and `await` them. The recursive `scan` becomes naturally cancellable (via `AbortSignal`). (See `refactor-libs.md` Phase 4.9.)

---

### T043: honor PROVAR_CONFIG_DIR and XDG_CONFIG_HOME env overrides
> importance: low
> affected areas: libs/config, apps/provar-cli

#### Problem
`libs/config/src/storage.ts:7-8` hard-codes `~/.provar/`. The producer flagged CLI-10 (Low). On Linux, `XDG_CONFIG_HOME` is the standard; for power users, an explicit env override is useful.

#### Solution
Add `PROVAR_CONFIG_DIR` env override (highest priority), then `XDG_CONFIG_HOME/provar/` (Linux), then `~/.provar/` (default). Add a one-line unit test for the override. (See `refactor-other-apps.md` Phase 5.8.)

---

### T044: add CI/build-time build-info tests in prover-web
> importance: low
> affected areas: apps/provar-web

#### Problem
Once `build-info.ts` exists (T023), it should have a test verifying it reads `import.meta.env.PUBLIC_*` correctly under different env values.

#### Solution
Add `apps/provar-web/tests/build-info.test.ts` using Vite's `loadEnv` in the test runner. (See `refactor-other-apps.md` Phase 7.4.)

---

### T045: add skip-link and aria-label to nav in prover-web
> importance: low
> affected areas: apps/provar-web

#### Problem
`+layout.svelte:27` has no `aria-label="Primary"` on the `<nav>`. No `id="main"` on `<main>`. No skip-link. A11y nits that the audit caught (Web-5, M-3 area).

#### Solution
Add `aria-label="Primary"` to the `<nav>`, `id="main"` to `<main>`, and a skip-link as the first child of the layout's main div targeting `#main`. (See `refactor-other-apps.md` Phase 3.8.)

---

### T046: rename telemetry.ts to trace-report.ts in provar-cli
> importance: low
> affected areas: apps/provar-cli

#### Problem
`apps/provar-cli/src/utils/telemetry.ts` is misnamed — it does not send telemetry, it renders a trace report. The single import is in `compile/index.ts:6`. Verified by audit (CLI-7).

#### Solution
Rename `telemetry.ts` → `trace-report.ts`. Rename `renderTraceReport` → `renderTraceTable`. Update the import. (See `refactor-other-apps.md` Phase 5.6.)

---

### T047: align the --up-to README flag with taskId terminology
> importance: low
> affected areas: apps/provar-cli

#### Problem
`apps/provar-cli/README.md:20` documents `--up-to <actionId>`. The actual implementation uses `taskId`. Verified by audit (CLI-6).

#### Solution
Update the README to `--up-to <taskId>`. (See `refactor-other-apps.md` Phase 5.5.)

---

### T048: tighten tsconfig compileOptions in apps/provar-cli
> importance: low
> affected areas: apps/provar-cli

#### Problem
`apps/provar-cli/tsconfig.json` does not opt into `noImplicitOverride` or `noFallthroughCasesInSwitch`. `noUncheckedIndexedAccess` is on at the root but the CLI does not explicitly inherit it. Producer flagged CLI-4 (Low).

#### Solution
Add a `compileOptions` block opting into `noImplicitOverride`, `noFallthroughCasesInSwitch`, and explicit `noUncheckedIndexedAccess`. (See `refactor-other-apps.md` Phase 5.9.)

---

### T049: drop the $components alias and the dead $lib import in prover-web
> importance: low
> affected areas: apps/provar-web

#### Problem
`svelte.config.js:18-20` alias points at a non-existent directory (Web-3). Component-level imports use `$components/...` which would resolve to nothing. Producer's `Web-3`.

#### Solution
Subsumed by T024.

---

### T050: add font preconnect consolidation in apps/provar-web
> importance: low
> affected areas: apps/provar-web

#### Problem
`apps/provar-web/src/app.html:17-22` has font preconnect links. The audit's Missed-6 (Low) noted that some are duplicated or could be consolidated.

#### Solution
Audit `app.html` and `+layout.svelte` for duplicate font preconnect links. Consolidate. Add a "Fonts and CDN policy" note to `docs/DESIGN.md`. (See `refactor-other-apps.md` Phase 8.3.)

---

### T051: surface parseTestFile code validation contract in README
> importance: low
> affected areas: libs/engine

#### Problem
`libs/engine/src/loader.ts` validates the `code` field of compiled test files (hash check, regex). The contract — when the hash mismatches, what the regex requires, what counts as "missing TS" — is undocumented. Producer flagged Lib-19 (Low).

#### Solution
Document in `libs/engine/README.md`. Add a unit test for the `code` field matrix. (See `refactor-libs.md` Phase 6.3.)

---

### T052: document the event ordering constraint in PathRunner.start
> importance: low
> affected areas: libs/engine

#### Problem
`PathRunner.start` and `events` JSDoc do not explain that `start()` must be called before or alongside `events()`; the `AsyncIterableController` buffers events between them. Producer flagged Lib-20 (Low). Race-y for new consumers.

#### Solution
Update JSDoc on `PathRunner.start` and `events` to document the ordering constraint. (See `refactor-libs.md` Phase 6.5.)

---

### T053: validate Project.variables shape at engine boundary
> importance: low
> affected areas: libs/engine, libs/domain

#### Problem
Even after the schema tightening in T011, downstream code uses `Record<string, string>` and `Record<string, unknown>` in different places. The boundary coercion is the safety net.

#### Solution
Add a `coerceToStringVariables(v: ProvarConfigVariables): Record<string, string>` helper in `libs/engine/src/loader.ts`. Call it at the engine boundary on `loadProject`. (See `refactor-libs.md` Phase 4.2.)

---

### T054: document ENV.* substitution scope in libs/engine README
> importance: low
> affected areas: libs/engine

#### Problem
`libs/engine/src/loader.ts:28-45` does `${ENV.VAR_NAME}` substitution. The scope (exact match only vs substring) is not documented. Producer flagged Lib-10 (Medium but the doc gap is Low).

#### Solution
Document the substitution rule in `libs/engine/README.md`. Consider scoping to exact matches (no substring substitution) with a regression test. (See `refactor-libs.md` Phase 4.8.)

---

### T055: tighten the deepMerge array-clear JSDoc
> importance: low
> affected areas: libs/config

#### Problem
`libs/config/src/storage.ts:79-89` `deepMerge` cannot express "clear" — `Partial<Settings>` cannot tell "leave alone" from "set to empty". The README/docs do not mention this.

#### Solution
Document "use empty array `[]` to clear lists" in the `deepMerge` JSDoc. (See `refactor-libs.md` Phase 2.8.)

---

### T056: clean up small Svelte 5 nits in provar-app
> importance: low
> affected areas: apps/provar-app

#### Problem
A handful of low-importance nits the audit caught: M-1 (duplicate `layerX.set(d, currentX)` in `graph-renderer.ts:308-316`), M-2 (Run button silent fallthrough to `runAllPaths`), M-3 (right-sidebar visibility effect with write-while-read), M-6 (viewMode reset is incomplete — diff state from previous node), M-8 (renderGraph defaults wipe state — transient flicker on file switch), M-9 (border-color selection logic duplicated in `node-shape.ts`), M-13 (`private` keyword on `$state` field, which Svelte 5 ignores).

#### Solution
Batch fix in a single cleanup PR. None are user-blocking; all are nits / maintainability / conventions. M-2 is a minor UX bug (the button tooltip says "Run all paths" but the click behavior changes silently based on selection state).

---

### T057: validate openProject path input
> importance: low
> affected areas: apps/provar-app

#### Problem
`menu.ts:88` extracts the path from `e.data.action.substring("open-recent:".length)` and calls `openProject({ path })`. The settings file is the source. If a hand-edited settings file contains `../../etc/passwd`, `openProject` will set the project dir to that path and trigger the FS watcher on it. `getAbsPath` blocks direct file reads outside the project, but the project dir itself is attacker-controlled. Defense-in-depth, not an active vulnerability. Verified by audit (M-11).

#### Solution
Validate the path is absolute and resolves within an allowed root before calling `openProject`. Reject relative paths or `..` traversals.

---

### T058: add CHANGELOG and update AGENTS.md after refactors
> importance: low
> affected areas: docs/

#### Problem
The refactors across this list (T001-T055) change the public surface in places. The project has no `CHANGELOG.md`. `AGENTS.md` does not reflect the post-refactor state.

#### Solution
Add a `CHANGELOG.md` entry per phase (or per release) summarizing user-visible changes. Update `AGENTS.md` if any refactor changes the public API in a breaking way. (See `refactor-libs.md` Phase 8.4 and `refactor-other-apps.md` Phase 9.4-9.5.)

---

### T059: record the curated-public-surface decision in an ADR
> importance: low
> affected areas: docs/

#### Problem
T013 (curate `@libs/engine` public surface) is a non-obvious design decision that future contributors will second-guess.

#### Solution
Add `docs/adrs/013-curated-public-surface-for-libs.md` capturing the design decision. Add `014-strict-typing-for-ai-sdk-boundary.md` for T033. Add `docs/architecture/libs-boundaries.md` and `apps-boundaries.md` diagrams. (See `refactor-libs.md` Phase 7 and `refactor-other-apps.md` Phase 8.)

---

## Optimizations

> Pass on 2026-06-17 focused on simplifications that **change no behaviour**:
> dead code, mechanical duplication, type/import hygiene, and silent
> performance hotspots. Cross-references to the T-items above are noted in
> each entry's `Solution` where overlap exists.
>
> Several entries in this section (T082, T085, T088, T091) directly
> resolve or progress pre-existing T-items in the list above. Specifically,
> T091 supersedes the prover-web URL externalization that was previously
> tracked across three separate items.

---

### T061: delete the unused `MutationTrackingPage` class and its test file
> importance: high
> affected areas: libs/engine

#### Problem
`libs/engine/src/runtime/mutation-tracking-page.ts` defines a wrapper class
with ten near-identical method declarations (one per `MUTATING_METHODS`
entry), each 4 lines of mechanical boilerplate. The class is re-exported
from `libs/engine/src/index.ts:10` but has zero production callers
(verified by `grep`). Its 142-line test file at
`libs/engine/src/__tests__/mutation-tracking-page.test.ts` is coverage of
the dead class. The class was meant to replace the monkey-patch still in
place at `test-run.ts:143-170` and `compiler/generator.ts:247-275`; the
"fix" never landed. (See T017.)

#### Solution
Delete the class file, the test file, and the `export *` line in
`libs/engine/src/index.ts:10`. Verify no other consumer imports
`MutationTrackingPage` or `MUTATING_METHODS` from the engine barrel
before deleting.

---

### T062: collapse the three `MUTATING_METHODS` lists into one
> importance: high
> affected areas: libs/engine

#### Problem
The same 10-element `as const` array is declared in three files:
`libs/engine/src/test-run.ts:143-154`, `libs/engine/src/compiler/generator.ts:247-258`,
and `libs/engine/src/runtime/mutation-tracking-page.ts:8-19` (last
removed by T061). Two copies remain after T061. (See T017, T032.)

#### Solution
Pick one home — recommend a new `libs/engine/src/runtime/mutating-methods.ts`
(5 lines) — and import from both call sites. Update the JSDoc on
`ExecuteOptions.maxEventQueueSize` to reference the consolidated constant
if it is also being addressed (T009 / T064).

---

### T063: delete `provarPath` from the entire `execute()` pipeline
> importance: high
> affected areas: libs/engine, apps/provar-app, apps/provar-cli

#### Problem
`ExecuteOptions.provarPath` is declared at `libs/engine/src/types.ts:78`,
documented, and threaded through `PathRunner`. `grep -n provarPath
libs/engine/src/test-run.ts` returns zero hits — the value is **never
read**. It is set in three call sites:
`libs/engine/src/compiler/sandbox.ts:113`,
`apps/provar-app/src/bun/rpc/streams.ts:173`,
`apps/provar-cli/src/commands/run/index.ts:110`. The plumbed-through
value also flows into `loadProject(project.path)` upstream in every
caller, so removing it loses no information.

#### Solution
Delete the field from `ExecuteOptions`, drop the three call-site
arguments, and verify the build still passes. If a downstream consumer
silently depended on the field, the type system will catch it.

---

### T064: delete or wire through `ExecuteOptions.maxEventQueueSize`
> importance: low
> affected areas: libs/engine

#### Problem
`maxEventQueueSize?: number` is declared at `libs/engine/src/types.ts:79-86`
with a default of 256 in the JSDoc, but `createAsyncIterable` is called
with no options at `test-run.ts:47`. The bound never applies. The intent
(per T009) is sound; today the option is documentation, not behaviour.

#### Solution
Pick one. Either pass `{ maxEventQueueSize: this.options.maxEventQueueSize ?? 256 }`
through to `createAsyncIterable` (and add a test for queue overflow), or
delete the field and its JSDoc until someone needs it. (See T009.)

---

### T065: delete the singular `convertCommandToTool` export
> importance: low
> affected areas: libs/models

#### Problem
`libs/models/src/tools.ts:16-25` exports `convertCommandToTool`. No
external caller imports it — only the plural `convertCommandsToTools`
at line 30 calls it internally. The plural is the one consumers use.

#### Solution
Delete the singular export. Inline the function body into the loop at
`convertCommandsToTools` (line 35-36) and stop the redundant indirection.

---

### T066: delete the `PROVAR_DIR` constant from `@libs/domain/zod`
> importance: low
> affected areas: libs/domain

#### Problem
`libs/domain/src/zod.ts:11` exports `PROVAR_DIR = ".provar"`, but the
only uses of it are as the prefix of `TESTS_DIR` and `CONFIG_FILE`,
both of which are also exported. Downstream apps use `TESTS_DIR` and
`CONFIG_FILE`, never `PROVAR_DIR` directly.

#### Solution
Delete the `PROVAR_DIR` export. Keep `TESTS_DIR` and `CONFIG_FILE` as
they are. The internal use in the file can become a local `const`. (See
T012 for the broader `.provar` literal problem in apps.)

---

### T067: delete the unused `getCodeStatus` helper
> importance: low
> affected areas: apps/provar-app

#### Problem
`CodeStatus` type and `getCodeStatus` function are exported from
`apps/provar-app/src/shared/utils.ts:55-66` but never imported anywhere
(verified by `grep`). The naming is also misleading — the actual UI
uses `editorStore.taskStates` to derive display status.

#### Solution
Delete the type and the function. (Verify with `grep -rn 'getCodeStatus' apps`
first.)

---

### T068: stop re-exporting `cleanCode` from the engine barrel
> importance: low
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/generator.ts:27-34` exports `cleanCode` and
it is re-exported through the `export *` barrel at
`libs/engine/src/index.ts:7`. The test file at
`__tests__/tracker.test.ts:5-24` exercises the function but reaches
into the internal path. The export shadows a local variable in
`compiler/sandbox.ts:44`. (See T040.)

#### Solution
Move the function to a new `libs/engine/src/compiler/clean-code.ts`,
re-import it from the test file, and drop the export from `generator.ts`.
Alternatively, keep the export but rename the local variable in
`sandbox.ts:44` to `stripped` so it stops shadowing (see T085). Either
way, `cleanCode` should not be re-exported through the engine barrel.

---

### T070: extract the screenshot-path helper from the three duplicated sites
> importance: high
> affected areas: apps/provar-app

#### Problem
The same path triple is recomputed in three places:
`apps/provar-app/src/bun/rpc/handlers/get-screenshots.ts:28-68`,
`apps/provar-app/src/bun/rpc/handlers/accept-visual-state.ts:27-69`,
and `apps/provar-app/src/bun/rpc/streams.ts:177-209`. Each site computes
`testsDir`, `relativePath`, `pathNameSlug`, `stepIndexStr`, and
`screenshotFile` from a `Path` and a `taskId` — about 30 lines of pure
copy-paste. Also fixes part of T012 (the `.provar` literal appears
9 times in these three files alone).

#### Solution
Extract a `screenshotPathFor(path: Path, taskId: string): { testsDir, relativePath, pathNameSlug, screenshotFile, currentFilePath, acceptedFilePath }`
into a new `apps/provar-app/src/bun/lib/screenshot-paths.ts` and call
it from all three sites. (See T012.)

---

### T071: extract a shared CLI arg parser
> importance: medium
> affected areas: apps/provar-cli

#### Problem
Both `handleCompile` (`commands/compile/index.ts:27-32`) and `handleRun`
(`commands/run/index.ts:24-32`) hand-roll positional-arg sweeps. The
top-level `index.ts:34-47` also hand-rolls subcommand dispatch. The
unknown-flag case is silently ignored (per the audit's Missed-5).

#### Solution
Create `apps/provar-cli/src/utils/args.ts` exporting
`parseArgs(args, knownFlags): { positional, flags, unknown }`. Use it in
both handlers. Have the top-level dispatch table-driven
(`COMMANDS: Record<string, (args) => Promise<void>>`). Add an
unknown-flag warning. (See T028.)

---

### T072: extract a generic `loggedRpcHandler` for the file operations
> importance: high
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/bun/rpc/handlers/file-handlers.ts:6-50` defines six
handlers, all the same shape:
`console.log("[RPC Server] X request:", params)` →
`getCommands().X.execute(params)` →
`console.log("[RPC Server] X response:", res)` →
`triggerProjectChanged()` (only on writes) → return. The `console.log`
calls are the data-leak vector T007 flags.

#### Solution
Replace with one `loggedHandler(name, commandKey, { triggersChange?: boolean })`
wrapper. Use it in all six handlers. This also gives one place to add
the DEBUG gate when T007 lands. (See T007.)

---

### T073: extract a `loggedRpcClient` wrapper for `ProvarAPI`
> importance: high
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/mainview/lib/api/provar.ts:14-310` defines 15
methods on `ProvarAPI`, each the same shape:
`console.log("[RPC Client] X request:", params)` →
`electroview.rpc!.request.X(params)` →
`console.log("[RPC Client] X response:", res)` → return. Same
data-leak issue as T072. The pattern is more mechanical on the client
side because the schema is statically known.

#### Solution
Either (a) wrap each method in a small `loggedCall(name, fn, ...args)`
helper, or (b) replace the object with a `Proxy` that adds the
log/return wrapper. Either way removes ~30 lines and gives one place
to add the DEBUG gate. (See T007.)

---

### T074: deduplicate `settings.loadIfNeeded` and `settings.reload`
> importance: low
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/mainview/lib/stores/settings-store.svelte.ts:43-57`
and `:63-71` both do `await ProvarAPI.getSettings()` and assign the
same three fields. The only differences are the `hasCheckedSetup`
guard and the first-launch wizard check.

#### Solution
Extract a private `loadFromDisk()` returning the full response. Have
`loadIfNeeded` call it, check `settingsExists`, and gate via
`hasCheckedSetup`. Have `reload()` call it without the guard.


### T076: deduplicate the `modelSettingsSchema` defaults
> importance: low
> affected areas: libs/config

#### Problem
`libs/config/src/schema.ts:47-77, 188-199` declares the same provider
defaults three times: once per provider schema (`.default(() => ({...}))`),
once on the outer `providers` object, and once on the top-level
`models` field. The duplication is intentional ("factory functions so
each parse gets a fresh, deep-cloned object") but the maintenance burden
is real.

#### Solution
Extract `DEFAULT_PROVIDERS` and `DEFAULT_MODELS` constants at the top
of the file, deep-cloned via a small `cloneDefault(o)` helper, and
reference them in all three places.

---

### T077: rename or unify the duplicate `ProviderConfigError` classes
> importance: medium
> affected areas: libs/config, libs/models, apps/provar-cli

#### Problem
Two distinct classes named `ProviderConfigError` exist:
`libs/config/src/schema.ts:143-162` (carries a `requirements` list) and
`libs/models/src/registry.ts:11-21` (carries only the provider name).
`apps/provar-cli/src/commands/compile/index.ts:8-10` has to alias both
(`ProviderConfigError as ConfigProviderError`,
`ProviderConfigError as ModelsProviderError`) to disambiguate.

#### Solution
Recommended: keep both, but rename the models-side to
`MissingApiKeyError`. It's a different error class semantically
(missing key vs. invalid config) and the shared name is misleading.
Drop the `as` aliases in the CLI. Alternative: pick one home (config,
since it's the gate) and have models throw that one. (See T033.)

---

### T078: delete the unused `innerTasks` binding in `compiler.ts`
> importance: trivial
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/compiler.ts:124` assigns
`const innerTasks = node.graph.tasks;` but the value is never read in
the block. `innerPaths` on the next line is the only one used.

#### Solution
Delete the line.

---

### T079: clean up the dead `resolveFn` default in `PathRunner`'s constructor
> importance: trivial
> affected areas: libs/engine

#### Problem
`libs/engine/src/test-run.ts:48-52` declares
`let resolveFn: (value: RunnerResult) => void = () => {};` whose default
no-op is overwritten on the next line and never called. The
`waitResolve` field is set in the constructor but only the local
`resolve` is ever read.

#### Solution
Collapse to:
```
let resolve: (value: RunnerResult) => void;
this.waitPromise = new Promise<RunnerResult>((r) => { resolve = r; });
this.waitResolve = resolve;
```
Or drop the `waitResolve` field entirely — the constructor's local
`resolve` is sufficient since the closure already captures it.

---

### T080: drop the dead `?? ["", ""]` fallback in `extractBlockBody`
> importance: trivial
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/extract-generated-code.ts:109` writes
`(l.match(/^(\s*)/) ?? ["", ""])[0]!.length`. The pattern `/^(\s*)/`
matches at the start of every string (it accepts the empty string), so
`match()` will never return `null`. The fallback is dead.

#### Solution
Replace with `l.match(/^(\s*)/)![1]!.length`.

---

### T081: deduplicate the command-class list in `commands/index.ts`
> importance: trivial
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/bun/commands/index.ts:1-9` has one `export *` block
of command modules; lines 11-19 list the same classes again explicitly
so the `createCommands()` builder can `new` them. The two parallel
lists can drift if a command is added.

#### Solution
Replace with a single
`const COMMANDS = { getConfig: GetConfigCommand, ... } as const` map.
Use the same map to derive both the re-exports and the builder.

---

### T082: fix the `any` type on `debounceTimer` in `bun/utils.ts`
> importance: trivial
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/bun/utils.ts:35` declares
`let debounceTimer: any = null;` for a `setTimeout` handle. Should be
`ReturnType<typeof setTimeout> | null` for cross-runtime safety.

#### Solution
Change the type annotation.

---

### T083: gate the agent-client `console.log` calls behind a DEBUG flag
> importance: low
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/compiler.ts:80-82, 87, 255-256` has three
unguarded `console.log` / `console.error` calls in the agent client
path. The first leaks the provider name; combined with the per-keystroke
volume in `provar-app`, this is the noisy end of the diagnostic
spectrum.

#### Solution
Gate all three behind a `DEBUG` env flag, or hoist a small `dlog()`
helper from a new `libs/engine/src/compiler/log.ts`. Combined with
T072/T073 this also gives one place to redact API keys. (See T007.)

---

### T084: rename the local `cleanCode` in `sandbox.ts` to `stripped`
> importance: trivial
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/sandbox.ts:44` declares
`let cleanCode = codeStr.replace(...).trim();` — a string that shadows
the exported `cleanCode` function from `generator.ts:27`. The local
reads as if it called the export.

#### Solution
Rename the local to `stripped`. (See T068 for the related export
cleanup.)

---

### T085: hoist `loadProject` out of the self-healing executor
> importance: high
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/generator.ts:295-299` calls `loadProject`
inside the `executor` closure passed to `SelfHealingLoop`. `loadProject`
is a recursive directory walk + full YAML parse of every `.test.yml`
in the project. The executor runs once per retry (up to 3). For a
50-task file with 3 retries: 4 full project loads per task = 200
redundant loads per compile.

#### Solution
The same load happens at line 61 of the same file, outside the
closure, where the result is captured into the outer `variables`. Pass
that `variables` value into the executor (via the existing
`options` parameter) and delete the inner `loadProject` call. (See
T086 for the parallel call site in `sandbox.ts`.)

---

### T086: hoist `loadProject` out of `runGroundingSandbox`
> importance: high
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/sandbox.ts:64-72` re-loads the project inside
`runGroundingSandbox`, which is called by both the stateful fast-path
and the safe-path, which is called by the self-healing executor. Per
task: up to 3 retries × 1 `loadProject` = 3 wasted project loads.
Same pattern as T085.

#### Solution
Accept `variables` as a parameter to `runGroundingSandbox`. The
callers (`compiler.ts:107-108` and `generator.ts:92-101, 136-144`)
already have the value or can get it once and pass it down.

---

### T087: deduplicate the `loadProject → variables` block
> importance: low
> affected areas: libs/engine

#### Problem
`libs/engine/src/compiler/generator.ts:58-65` and
`libs/engine/src/compiler/sandbox.ts:63-72` contain two copies of the
same:
`let project: any = null; try { project = await loadProject(...); variables = ... } catch (e) {}`.
The `as unknown as` cast at line 62 is the cast TODOS T033 groups with
similar cleanups.

#### Solution
Extract to `loadVariablesForCompilation(yamlPath): Promise<Record<string, string>>`
in `loader.ts` and call once at the entry point of `compileProgress`.
The cast disappears with the helper. (See T029, T033.)

---

### T088: replace `Math.random().toString(36).substring(7)` for `runId` with `crypto.randomUUID()`
> importance: low
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/bun/rpc/streams.ts:168` uses
`const runId = Math.random().toString(36).substring(7);` for a stream
run identifier. Same anti-pattern T021 catches in `apps/demo-social`.

#### Solution
Replace with `crypto.randomUUID()`. Also verify whether the `runId` is
actually consumed by the webview — if not, the whole computation can
go.

---

### T089: reuse the `loadProject` result after auto-compile in `streams.ts`
> importance: low
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/bun/rpc/streams.ts:128, 152` calls `loadProject`
twice in the auto-compile path: once to check staleness, once after
compile to read the post-compile file. The first `project` object is
discarded; the second rebuilds the file walk and YAML parses for the
whole project.

#### Solution
Reuse the first `loadProject` result. After auto-compile, just call
`project.readFile(absPath)` again — the `readFile` is the expensive
part, but it does not re-walk the project tree.

---

### T090: dedupe `loadScreenshotsForNode` per node-id
> importance: medium
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/mainview/lib/stores/editor-store.svelte.ts:344-359`
is called from 5 sites (`editor-store.svelte.ts:269, 281, 286, 404, 427`)
in quick succession for the same `nodeId`. A 50-task run fires 3+
per task (start, finish, visual-compare) = 150 IPCs, each reading a
PNG from disk and base64-encoding it. (See T031.)

#### Solution
Add a `Map<nodeId, Promise<...>>` and have `loadScreenshotsForNode`
return the cached promise for concurrent calls — the same pattern
already used for `loadGeneratedCodeForNode` at
`editor-store.svelte.ts:98, 370-389`. Clear the map on `loadFile`
(line 416-430) to avoid stale entries after a file switch.

---

### T091: remove the 4 hardcoded `github.com/thani-sh/provar` strings in `provar-web`
> importance: low
> affected areas: apps/provar-web

#### Problem
`apps/provar-web/src/lib/build-info.ts` was created (T023 fix) and is
already used in `+page.svelte:29, 55, 183` and `+layout.svelte:42, 67`.
But `+page.svelte:99, 224, 250, 259` still hardcode
`https://github.com/thani-sh/provar` directly.

#### Solution
Replace the 4 literals with `buildInfo.githubRepo` references.

---
