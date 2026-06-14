# TODOS

---

### T001: publish prover.se/install.sh or gate the install command on the marketing site
> importance: critical
> affected areas: apps/provar-web

#### Problem
`apps/provar-web/src/routes/+page.svelte` advertises `curl -fsSL https://provar.se/install.sh | sh` as the primary install command, but that URL currently 404s — `provar.se` still serves an unrelated "feedback collection" product. A second install line points users at `bun add -g @apps/provar-cli`, which is the private workspace name and is not on npm. Both are user-facing, copy-paste-ready commands that silently fail.

#### Solution
Either ship a real `install.sh` at `provar.se/install.sh` and publish `@provar/cli` to npm (per AGENTS.md: `@provar/` is the public npmjs scope), or gate the install block behind a `PUBLIC_INSTALL_LIVE` env flag and replace the copy with a "coming soon" placeholder. Drop the `bun add -g @apps/provar-cli` line until `@provar/cli` is actually published. (See `refactor-other-apps.md` Phase 1.)

---

### T002: stop the marketing site from claiming a working install
> importance: critical
> affected areas: apps/provar-web

#### Problem
Even if `provar.se/install.sh` is published later, today's site advertises a non-existent endpoint to a brand-new customer-facing surface. The worst kind of marketing copy: a working-looking command that silently 404s.

#### Solution
Same fix as T001 — gate behind `PUBLIC_INSTALL_LIVE` and show a disabled card with a "star the repo" prompt until the install is actually live. Externalize all hard-coded URLs (`PUBLIC_GITHUB_REPO`, `PUBLIC_DOWNLOAD_BASE`, `PUBLIC_INSTALL_BASE`) into `apps/provar-web/src/lib/build-info.ts` so a staging deploy can be configured separately. (See `refactor-other-apps.md` Phase 1 and Phase 3.)

---

### T003: prevent silent data loss in loadSettings on corrupt settings.json
> importance: critical
> affected areas: libs/config

#### Problem
`libs/config/src/storage.ts:52-63` returns the default `Settings` object silently when `~/.provar/settings.json` is malformed. The user's `recentProjects`, custom shortcuts, and any other settings are gone with no signal, and the next save overwrites the original file with defaults. Verified by the audit (Lib-4, C-4).

#### Solution
Split `loadSettings` into two paths: a "no file" path that returns defaults, and every other error (parse / validation) that re-throws. On parse failure, rename the corrupt file to `~/.provar/settings.json.bak.<isoTimestamp>` before re-throwing. Export a `SettingsLoadError` carrying `{ cause, backupPath }` so the caller can surface a UI message. Update `ensureSettings` to only call the "no file" path. Add a unit test that writes a truncated `settings.json` and asserts the backup file exists. (See `refactor-libs.md` Phase 1.)

---

### T004: fix the per-keystroke writeFile + refreshFiles race in the node side panel
> importance: critical
> affected areas: apps/provar-app

#### Problem
`node-side-panel.svelte:189, 204` wires `oninput` (not `onchange`) to `handleTitleChange` / `handleInfoChange`. Every keystroke runs: `updateNode` (structuredClone) → `saveFile` IPC → YAML.stringify → disk write → `triggerProjectChanged` → `refreshFiles` directory scan. The `fs.watch` debounce (100ms) is bypassed by the direct `triggerProjectChanged` call, so a second refresh fires within ~150ms. Compounds with `console.log` volume (H-12) — a 50-node file turns every keystroke into ~10KB of console output. Verified by audit (App-3, C-3).

#### Solution
Debounce 200-300ms, or write on blur. Drop the per-keystroke `refreshFiles` call — refresh only on file-switch or external change. Move `console.log` calls behind a `DEBUG` env flag and redact API keys. (See `CODE-REVIEW-REPORT.md` suggested fix order step 5 and H-12.)

---

### T005: wire the editor to the engine's diamond-graph dedup, not the old enumeratePaths
> importance: critical
> affected areas: apps/provar-app, libs/engine

#### Problem
The recent fix in `libs/engine/src/loader.ts:buildGraphPaths` adds path-signature dedup with an `emittedSignatures` set. But `apps/provar-app/src/mainview/lib/utils/graph.ts:enumeratePaths` is the OLD duplicate-prone implementation, and the editor store + canvas active-path highlight both consume it. For any diamond-shaped test file, the editor shows the wrong "active path" and the "smart run" target is the duplicate path. The fix is functionally dead. A cycle in the graph crashes `$derived.by(() => enumeratePaths(...))` with a stack overflow. Verified by audit (App-2, C-2).

#### Solution
Delete `enumeratePaths` from `apps/provar-app`; import `buildGraphPaths` from `@libs/engine` directly. Update the editor-store's `$derived.by`, `selectedNodePathIndex`, and `runningPathNodeIds` to consume the engine's path list. Add a unit test for `buildGraphPaths` covering linear, diamond with rejoin, cycle (should return empty/throw safely), and missing-node. (See `refactor-libs.md` Phase 3 and `CODE-REVIEW-REPORT.md` T-1.)

---

### T006: fix runAllPaths re-entrancy guard
> importance: critical
> affected areas: apps/provar-app

#### Problem
`runAllPaths` (`editor-store.svelte.ts:186-200`) checks `this.isRunning` at line 188 and returns if true, but does NOT re-check inside the for-loop. `runStream` (which `runAllPaths` awaits per-path) sets `isRunning = false` in its `finally` block. Between two adjacent path runs in the same loop, `isRunning` is `false`. A second click on "Run all" passes the guard, starts a parallel `runPath` loop, and interleaves two `ProvarAPI.runTestPath` calls on the same file. The misleading comment at line 172-174 says "runAllPaths itself is a no-op when isRunning is true" — that is only true for the FIRST check. Verified by audit (App-1, C-1).

#### Solution
Keep `isRunning = true` for the full `runAllPaths` loop; only clear it after all paths complete. Or use a separate `isRunningAllPaths` flag. (See `CODE-REVIEW-REPORT.md` step 4.)

---

### T007: gate and redact API keys in console output
> importance: high
> affected areas: apps/provar-app

#### Problem
`apps/provar-app/src/mainview/lib/api/provar.ts:31` logs the full `settings` object on `saveSettings`, which includes `settings.models.providers.openai.apiKey`. 100+ `console.log` calls in the dev console dump full request/response payloads for every API call, including user API keys. Combined with the per-keystroke writeFile race (T004), the volume is also a privacy problem for anyone sharing a screen. The audit promoted this from Low to High (App-15, H-12).

#### Solution
Gate log statements behind a `DEBUG` env flag. Redact keys from payloads (`{ apiKey: '***' }` or similar). Remove the unconditional `console.log` of the full request/response in `provar.ts:114-118` and `file-handlers.ts:20-26`.

---

### T008: wire Runner.pause/resume/cancel to a UI Stop button
> importance: high
> affected areas: apps/provar-app, libs/engine

#### Problem
`Runner` (`libs/engine/src/types.ts:60-68`) declares `pause()`, `resume()`, `cancel()`, `wait()`. `PathRunner` implements all four (`test-run.ts:109-119`). The webview consumer in `bun/rpc/streams.ts:186-253` runs `for await` to completion with no cancel signal. The App toolbar (`App.svelte:295-345`) has no Stop button. A 5-minute visual-regression test cannot be aborted without closing the canvas. Compounds with the missing SIGINT handler in the CLI (T014). Verified by audit (App-6, H-2).

#### Solution
Add an active-stream field in the webview; on Stop click, call `runner.cancel()`. Add a Stop button to the run toolbar. Make the CLI run/compile commands honor SIGINT/SIGTERM (see T014). Update the engine's `PathRunner` so `start()` failures are surfaced via `wait()` and a `run-finished` event with `status: "failed"` (Lib-22).

---

### T009: enforce the runner event queue bound (maxEventQueueSize)
> importance: high
> affected areas: libs/engine, apps/provar-app

#### Problem
`libs/engine/src/types.ts:79-86` declares `maxEventQueueSize?: number` with a default of 256. `test-run.ts:47` calls `createAsyncIterable<RunnerEvent>()` with NO options. The underlying `@thani-sh/iterables` queue is unbounded. During a long visual-regression run, `screenshotBase64` bytes accumulate in the bun heap, and the memory ceiling is "until OOM". Verified by audit (App-5, H-3, Lib-6).

#### Solution
Pass the bound through: `createAsyncIterable({ maxEventQueueSize: 256 })` (or pass through the `ExecuteOptions` value). If the option name is different, update the JSDoc to match. Add a test for queue overflow behavior.

---

### T010: fix the file-switch screenshot race (loadScreenshotsForNode)
> importance: high
> affected areas: apps/provar-app

#### Problem
`loadFile` (`editor-store.svelte.ts:363-376`) fires `loadScreenshotsForNode` for each node in a for-await that does NOT await. If the user opens a second file while the first file's screenshot loads are in flight, the in-flight responses resolve against the new (empty) `screenshots` object and attach the previous file's screenshots to the new file's node IDs. Node IDs are 5-char random strings, so collisions are unlikely, but the race is real. Verified by audit (M-5, H-13).

#### Solution
Track an in-flight token; only apply the response if the token still matches the current file. Abort controllers are cleaner. Also dedupe concurrent `loadScreenshotsForNode` calls per node (M-12) — a 50-task run triggers 3+ calls per node (start/finish/visual-compare), each doing a full base64 IPC.

---

### T011: consolidate the three Project.variables type definitions into one Zod source
> importance: high
> affected areas: libs/config, libs/domain, libs/engine

#### Problem
`Project.variables` has three different types: `z.record(z.string(), z.any())` in `libs/config/src/schema.ts:configSchema`, `z.record(z.string(), z.string())` in `libs/domain/src/zod.ts:schemaForLoadedProject`, and `Record<string, string>` in the manual `Project` interface in `libs/domain/src/types.ts`. The compiler enforces all three at the boundary; the union collapses to the loosest (`any`). Downstream code uses `Record<string, string>` and `Record<string, unknown>` in different places, with `(cfg as any)` casts. The deep root of the producer's Lib-7 symptom. Verified by audit (Lib-7, H-10).

#### Solution
Pick one source of truth — Zod schema — and derive everything else (`type Project = z.infer<typeof projectSchema>`). Replace `configSchema.variables: z.record(z.string(), z.any())` with `z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()`. Add a `coerceToStringVariables(v)` helper at the engine boundary. Delete the manual `Project` interface and the four downstream casts. (See `refactor-libs.md` Phase 4.)

---

### T012: replace .provar string literals with TESTS_DIR from @libs/domain
> importance: high
> affected areas: apps/provar-cli, apps/provar-app, libs/domain, libs/config

#### Problem
`@libs/domain/zod` exports a `TESTS_DIR` constant for the project-local directory. Apps hand-roll `.provar`-string concatenation in 18+ places. If `.provar` ever changes to `.provar-project`, all 18+ sites have to be updated in lockstep. The producer's Lib-9 flagged the libs side; the audit caught the apps side (Missed-1, H-9). The bigger half of the boundary leak.

#### Solution
Move `PROVAR_DIR`, `TESTS_DIR`, `CONFIG_FILE` from `libs/domain/src/zod.ts:11-21` to a new `libs/config/src/paths.ts` (or `libs/domain/src/paths.ts`). Update the 18+ app call sites to import the constant. `grep -rn '\.provar' apps/` should return zero hits in path contexts. (See `refactor-libs.md` Phase 3.4 and `refactor-other-apps.md` coordination note.)

---

### T013: curate the @libs/engine public surface and document it
> importance: high
> affected areas: libs/engine

#### Problem
`libs/engine/src/index.ts` re-exports ~30 internal names via `export *`. Only 4 are used externally (`loadProject`, `compile`, `execute`, the type set). The over-exposed surface makes the engine a barrel — future refactors can't break internal helpers without breaking "the public API" (Lib-2, H-2 from the libs side). The other 3 libs have a README; `@libs/engine` doesn't (Lib-3).

#### Solution
Replace the `export *` barrel with a curated list (see `refactor-libs.md` Appendix A for the exact contents). Move `cleanCode`, `compileCodeToFunction`, `CompilerGroundingSession`, `BrowserSession`, `launchBrowserSession`, `buildGraphPaths`, `parseTestFile`, `MUTATING_METHODS`, `PathRunner`, etc. into per-file `internal` namespaces. Add `libs/engine/README.md` describing the `loadProject → readFile → execute` chain, the public types, and a usage example. Add an ADR capturing the decision.

---

### T014: handle SIGINT/SIGTERM in provar-cli compile and run
> importance: high
> affected areas: apps/provar-cli

#### Problem
`apps/provar-cli/src/commands/compile/...` and `run/...` can hang 30+ seconds in an LLM call. A user pressing Ctrl-C gets no graceful shutdown — the LLM call continues and any Playwright browsers the compile launched stay open until the process is killed. Orphan browser processes accumulate. Verified by audit (CLI-5, H-8).

#### Solution
Register a `process.on("SIGINT", ...)` and `process.on("SIGTERM", ...)` that sets a `cancelled` flag, awaits the in-flight command's `finally` block, and exits with 130. Check the flag between tasks and abort early. Standardize exit codes: 0 = success, 1 = runtime error, 2 = usage error, 130 = SIGINT.

---

### T015: return exit 2 on unknown CLI subcommand
> importance: high
> affected areas: apps/provar-cli

#### Problem
`apps/provar-cli/src/index.ts:30-38` has no `else` branch after the two `if (command === ...)` blocks. A typo in the subcommand name (`provar compilee ./foo` instead of `provar compile ./foo`) returns exit code 0 — the CLI does not recognize the failure. CI runs that misspell the command will pass. Verified by audit (CLI-1, H-6).

#### Solution
Add an `else` branch that logs "Unknown command: <cmd>" + the help text and calls `process.exit(2)`. Document the exit-code convention in `apps/provar-cli/README.md` or `docs/cli/exit-codes.md`.

---

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

### T021: harden demo-social auth shape (sandbox-only banners + crypto.randomUUID)
> importance: high
> affected areas: apps/demo-social

#### Problem
`apps/demo-social/src/server/store.ts` uses `passwordHash !== password` (Demo-1, Critical — wrong shape for future contributors to copy). Uses `Math.random().toString(36).substr(2, 9)` for IDs at lines 83, 175 (Demo-2). Session token at lines 108-109 uses two `Math.random()` calls. Even though the demo is a sandbox, the *shape* of the auth code is what future contributors will copy.

#### Solution
Add a banner comment at the top of `store.ts`: "Sandbox only — passwords are stored as plain text, no hashing. Do NOT copy this module's auth shape into a real product." Switch all `Math.random()` ID generation to `crypto.randomUUID()`. (See `refactor-other-apps.md` Phase 2.)

---

### T022: bind demo-social to 127.0.0.1 and add body-size guards
> importance: high
> affected areas: apps/demo-social

#### Problem
`apps/demo-social/index.ts:3-9` binds to `localhost:3000` (should be `127.0.0.1`). No body-size limit on POST routes (Demo-3). Compounded by the in-memory state warning (Demo-5) — the demo runs in dev mode and accepts unbounded payloads. Verified by audit (Demo-3, Demo-4, Missed-3).

#### Solution
Bind to `127.0.0.1` explicitly. Add a `Bun.write` body-size guard on every `POST` route that reads `req.json()`; reject bodies > 64 KB with `413 Payload Too Large`. Add a "sandbox" banner to the home page. Replace the runtime Tailwind CDN with a local build (Missed-3, Medium but adjacent to operational hygiene).

---

### T023: externalize hard-coded prover-web URLs into build-time env
> importance: medium
> affected areas: apps/provar-web

#### Problem
The install command, the GitHub repo URL, and other deployment-specific strings are hard-coded in `apps/provar-web/src/routes/+page.svelte`. A staging deploy looks identical to a production deploy. Cannot stage the site without leaking the production install endpoint, and vice versa. Verified by audit (Web-1, H-11).

#### Solution
Add `PUBLIC_GITHUB_REPO`, `PUBLIC_DOWNLOAD_BASE`, `PUBLIC_INSTALL_BASE` to `.env` / `.env.example`. Create `apps/provar-web/src/lib/build-info.ts` exporting them with fallbacks. Replace the 6 GitHub URL call sites and the install command in `+page.svelte` and `+layout.svelte` to read from `build-info.ts`. (See `refactor-other-apps.md` Phase 3.)

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

### T034: use crypto.randomUUID for IDs in demo-social (subsumed by T021)
> importance: medium
> affected areas: apps/demo-social

#### Problem
Same as T021.

#### Solution
Subsumed by T021.

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

### T037: fix the localStorage token shape in demo-social
> importance: medium
> affected areas: apps/demo-social

#### Problem
`apps/demo-social/src/client/app.tsx` stores the session token in `localStorage` without any expiry or rotation. The audit caught this (Demo-4, Medium). The demo is a sandbox, so the security impact is contained, but the pattern leaks into real apps when contributors copy it.

#### Solution
Add a banner comment in `app.tsx`: "DEMO ONLY — DO NOT COPY this auth pattern. Tokens are unencrypted in localStorage with no rotation." Optionally: switch to a `sessionStorage` cookie, or rotate the token on every page load.

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

### T041: drop the placeholder field from settingsSchema
> importance: medium
> affected areas: libs/config, apps/provar-cli

#### Problem
`libs/config/src/schema.ts:62` has a `placeholder` field in `settingsSchema`. The README has a row for it. Producer flagged CLI-9. No consumer reads it. The audit confirmed (Missed area).

#### Solution
Drop the field from the schema and the README row. (See `refactor-other-apps.md` Phase 5.7.)

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
