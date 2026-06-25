# 015 - Curated Public Surface for `@libs/engine`

## Context

`libs/engine/src/index.ts` was a barrel file with eleven `export *`
statements, re-exporting ~30 internal names (`cleanCode`,
`CompilerGroundingSession`, `BrowserSession`, `launchBrowserSession`,
`buildGraphPaths`, `parseTestFile`, `MUTATING_METHODS`, `PathRunner`,
`compileCodeToFunction`, `runGroundingSandbox`,
`CompilerPerformanceTracker`, `TaskTelemetry`, `CompilationTrace`, ...).
A repo-wide audit (`docs/TODOS.md` T013, `Lib-2`, `H-2`) found that only
four names are actually imported from `@libs/engine` by external
applications:

- `apps/provar-cli/src/commands/run/index.ts` — `execute`, `loadProject`
- `apps/provar-cli/src/commands/compile/index.ts` — `compile`, `loadProject`
- `apps/provar-app/src/bun/rpc/streams.ts` — `compileProgress`, `execute`, `loadProject`
- `apps/provar-app/src/bun/rpc/handlers/get-node-generated-code.ts` — `getNodeGeneratedCode`
- `apps/provar-app/src/bun/rpc/handlers/get-screenshots.ts` — `loadProject`
- `apps/provar-app/src/bun/rpc/handlers/accept-visual-state.ts` — `loadProject`
- `apps/provar-app/src/bun/commands/read-file-command.ts` — `loadProject`

Plus the `TestAPI` type, which appears in generated `.test.ts` source
strings and in JSDoc. The over-exposed barrel has three concrete problems:

1. **Future refactor friction.** Any rename or signature change of an
   internal helper risks breaking the "public API" even though no consumer
   uses it. The `cleanCode` shadowing in `compiler/sandbox.ts` and the
   dead `MutationTrackingPage` / `MUTATING_METHODS` re-export are
   symptoms of the same root cause: internal helpers are reachable from
   outside without anyone deciding they should be.
2. **Discovery cost.** New contributors see ~30 names on the package's
   surface and cannot tell which ones are safe to depend on. They either
   import everything (compounding problem 1) or import carefully but with
   low confidence.
3. **Documentation gap.** `@libs/engine` had no README; the other three
   libs (`@libs/config`, `@libs/domain`, `@libs/models`) did. The
   discrepancy hid the lack of a curated contract — readers assumed the
   `export *` list *was* the contract.

## Decision

We replace the `export *` barrel with a deliberately curated public
surface in `libs/engine/src/index.ts`. Internal helpers that the engine
itself and adjacent tests still need are gathered into a separate
`libs/engine/src/internal.ts` barrel, exposed only via the
`@libs/engine/internal` package export.

### Public surface (`@libs/engine`)

| Name | Kind | Source |
|---|---|---|
| `loadProject` | function | `./loader` |
| `ProjectLoader` | type | `./loader` |
| `compile` | function | `./compiler/compiler` |
| `compileProgress` | function | `./compiler/compiler` |
| `CompileEvent` | type | `./compiler/compiler` |
| `CompileResult` | type | `./compiler/compiler` |
| `CompilerOptions` | type | `./compiler/compiler` |
| `getNodeGeneratedCode` | function | `./compiler/extract-generated-code` |
| `execute` | function | `./test-run` |
| `ExecuteOptions` | type | `./test-run` |
| `Runner` | type | `./test-run` |
| `RunnerEvent` | type | `./test-run` |
| `RunnerResult` | type | `./test-run` |
| `RunnerState` | type | `./test-run` |
| `TestAPI` | type | `./types` |

### Internal surface (`@libs/engine/internal`)

Reachable only by engine-internal modules and adjacent tests under
`libs/engine/src/__tests__/`:

- `BrowserSession`, `launchBrowserSession` — `./browser`
- `saveScreenshotToTmp` — `./screenshot`
- `buildGraphPaths`, `parseTestFile` — `./loader`
- `PathRunner` — `./test-run`
- `cleanCode`, `CompilerGroundingSession`, `groundAndGenerateTask` — `./compiler/generator`
- `compileCodeToFunction`, `runGroundingSandbox` — `./compiler/sandbox`
- `CompilerPerformanceTracker`, `CompilationTrace`, `TaskTelemetry` — `./compiler/tracker`
- `GroundingContext` — `./types`
- `MUTATING_METHODS`, `MutationTrackingPage`, `MutatingMethod` — `./runtime/mutation-tracking-page`
- `expect` — `@playwright/test`

### Package exports

`libs/engine/package.json` gains a `./internal` sub-path so the internal
barrel is only reachable by deliberate import:

```json
"exports": {
  ".": "./src/index.ts",
  "./internal": "./src/internal.ts"
}
```

### README

`libs/engine/README.md` is added (it was the only library without one)
and documents:

- The public-surface table above.
- The `loadProject → readFile → execute` chain.
- Usage examples for `loadProject`, `compileProgress`, and `execute`.
- The `${ENV.VAR_NAME}` substitution scope (T054).
- The generated `.test.ts` contract and the `TestAPI` shape.
- The `PathRunner.start` event-ordering constraint (T052).

### Rule for new symbols

When adding a new symbol to `@libs/engine`:

1. If a consumer in `apps/` needs it, add it to the public
   `src/index.ts` with an explicit named `export`.
2. If only engine-internal modules need it, add it to the source file's
   regular `export` and re-export from `src/internal.ts` if other engine
   files need it (most do not — relative imports work).
3. Do **not** add an `export *` back into `src/index.ts`. The barrel
   is curated by hand, on purpose.

## Consequences

- **Refactor safety.** Internal helper renames (e.g. collapsing the three
  `MUTATING_METHODS` copies per T062) will no longer be blocked by
  external dependents — there are none.
- **Clear contract.** The 15-name public surface is the engine's API. It
  is documented in `libs/engine/README.md` and tracked in this ADR. New
  contributors do not need to read every internal module to know what is
  safe to call.
- **Discoverability.** Removing the `expect` re-export from the public
  barrel (which only engine code and tests use) eliminates a confusing
  "is this part of Playwright or part of the engine?" question.
- **Two-tier imports.** Engine-internal modules that previously did
  `import { foo } from "@libs/engine"` for an internal helper will now
  either (a) use a relative path (preferred — keeps the dependency graph
  explicit) or (b) switch to `@libs/engine/internal`. Tests in
  `__tests__/` use relative paths and need no change.
- **Breaking change for accidental external consumers.** Any code outside
  `@libs/engine` that imports `cleanCode`, `PathRunner`, etc. from
  `@libs/engine` will now fail to type-check. A repo-wide `grep` confirmed
  no such imports exist; the only `from "@libs/engine"` consumers are
  listed in the Context section, and all of them use names in the public
  surface.
- **No removal of dead code yet.** `MutationTrackingPage`,
  `MUTATING_METHODS`, `cleanCode` re-export, and the `provarPath` field
  remain in place under the internal barrel — they are real, working
  code that other engine modules use. Removing them is a separate piece
  of work tracked under T017, T040, T061, T062, T063, T064, T068.
- **No `tests/` directory split.** The engine keeps its `__tests__/`
  co-located layout; the `./internal` entry is reserved for sibling code,
  not for tests.
