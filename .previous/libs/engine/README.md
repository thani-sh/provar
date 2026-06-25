# @libs/engine

The Provar engine. Loads test projects, compiles declarative `.test.yml` graphs
into runnable `.test.ts` code with AI grounding, and executes those compiled
files against a real browser via Playwright.

This package is consumed by `apps/provar-app` (the desktop editor) and
`apps/provar-cli` (the headless runner). The other three libs (`@libs/domain`,
`@libs/config`, `@libs/models`) are also dependencies.

## Public surface

The engine exposes a deliberately small public surface. Internal helpers
(grounding sandbox, mutation tracker, parser internals, performance tracker)
are reachable via `@libs/engine/internal` for engine-internal use only;
external applications must not import from there.

| Name | Kind | Purpose |
|---|---|---|
| `loadProject` | function | Discover a `.provar/` project (or load a single test file) and return its parsed contents. |
| `ProjectLoader` | type | Contract for the `loadProject` return value; `readFile(path)` re-reads one file without re-walking the tree. |
| `compile` | function | Compile a `.test.yml` file to `.test.ts`. Returns the final compile result. |
| `compileProgress` | function | Same compilation as a streaming async iterable; yields `compile-started`, `node-started`, `node-succeeded`/`node-failed`, `compile-finished` events. |
| `CompileEvent` | type | Discriminated union of all `compileProgress` event payloads. |
| `CompileResult` | type | Final result returned by `compile` / yielded by `compile-finished`. |
| `CompilerOptions` | type | Options for `compile` / `compileProgress`. |
| `getNodeGeneratedCode` | function | Read the already-compiled `.test.ts` for a node from disk, returning the function body for preview. |
| `execute` | function | Run one compiled test file path against a real browser; returns an async iterable of `RunnerEvent`. |
| `ExecuteOptions` | type | Options for `execute` (browser mode, timeouts, cancellation). |
| `Runner` | type | The runner's pause / resume / cancel / wait contract. |
| `RunnerEvent` | type | Discriminated union of all `execute` event payloads (`task-started`, `task-finished`, `task-failed`, `screenshot-captured`, `run-finished`, ...). |
| `RunnerResult` | type | Final result returned by `execute`. |
| `RunnerState` | type | Mid-run snapshot of runner status. |
| `TestAPI` | type | The surface compiled task code is allowed to call (Playwright `page` plus event helpers). Emitted into generated `.test.ts` as `import type { TestAPI }`. |

Anything not in the table above is internal. If you need a new symbol from an
application, add it to `src/index.ts` deliberately — do not reach into
`@libs/engine/internal`.

## The `loadProject → readFile → execute` chain

The engine answers three questions for an application:

1. **What tests does this project have?** — `loadProject` walks up from a
   given path to find the `.provar/` directory, parses every `.test.yml`,
   resolves their linear execution paths, and returns a `ProjectLoader` that
   can re-read any one file.
2. **What does the AI-generated code for a node look like?** —
   `getNodeGeneratedCode` reads the on-disk `.test.ts` for a node and returns
   the function body for preview in the editor.
3. **How do I actually run a test?** — `execute` takes a `Path` (resolved by
   `loadProject`) plus an `ExecutableFile` (loaded by `readFile`) and runs it
   against a real browser, emitting `RunnerEvent`s the application can stream
   to its UI.

`compile` (and its streaming sibling `compileProgress`) sits between the first
two steps: it turns `.test.yml` into the `.test.ts` that `execute` later runs.

## Usage

### Load a project

```ts
import { loadProject } from "@libs/engine";

const project = await loadProject("/path/to/project");

for (const file of project.files) {
  console.log(file.path, file.paths.length, "paths");
}

// Re-read a single file after a save — no full re-walk.
const updated = await project.readFile(file.path);
```

### Compile with progress

```ts
import { compileProgress } from "@libs/engine";

for await (const event of compileProgress({
  filePath: "/path/to/login.test.yml",
  session,
  variables: {},
  onAutoAccept: () => {},
})) {
  switch (event.type) {
    case "node-started":
      console.log(`→ ${event.nodeId}`);
      break;
    case "node-succeeded":
      console.log(`✓ ${event.nodeId}`);
      break;
    case "node-failed":
      console.log(`✗ ${event.nodeId}: ${event.error}`);
      break;
    case "compile-finished":
      console.log(`done: ${event.result.successCount}/${event.result.totalCount}`);
      break;
  }
}
```

### Execute a path

```ts
import { execute } from "@libs/engine";

for await (const event of execute({
  projectPath: "/path/to/project",
  path: resolvedPath,
  executableFile,
  variables: {},
  onAutoAccept: () => {},
  onActivity: () => {},
  onAutoAcceptDiff: () => {},
})) {
  switch (event.type) {
    case "task-started":
      console.log(`→ ${event.taskId}`);
      break;
    case "task-finished":
      console.log(`✓ ${event.taskId}`);
      break;
    case "run-finished":
      console.log(`done: status=${event.result.status}`);
      break;
  }
}
```

## ENV.* variable substitution

`loadProject` performs a single-pass substitution of `${ENV.VAR_NAME}`
placeholders in YAML field values. The pattern is matched exactly — only
strings that consist *entirely* of `${ENV.NAME}` are substituted; partial
substrings like `prefix-${ENV.NAME}-suffix` are left as-is. Missing
environment variables become the empty string.

## Generated `.test.ts` contract

Every compiled task is a top-level `async function` exported as the default
export, with this signature:

```ts
export default async function task({ page, expect, emit }: TestAPI): Promise<void> {
  await page.goto("https://example.com/login");
  await page.fill('input[name="email"]', "user@example.com");
  await page.click('button[type="submit"]');
}
```

The function receives a `TestAPI` — see the type above. It must return
successfully (no throw) for the task to be considered passed. Generated code
is serialized to disk with a hash header that the runner verifies before
loading.

## Event ordering in `PathRunner.start`

When you `await` the runner's events iterator, you must call `runner.start()`
either before consuming the iterator or concurrently with the first
`for await` step. The `AsyncIterableController` buffers events between them,
but later events emitted *before* `start()` is called are lost. This ordering
constraint is intentionally undocumented at runtime — see ADR 015.
