/**
 * @libs/engine — curated public surface.
 *
 * Only the names below are part of the engine's external contract. Internal
 * helpers (browser session, mutation tracker, sandbox helpers, parser
 * internals, performance tracker, etc.) are intentionally NOT re-exported
 * here. Consumers inside the engine package and adjacent tests reach them via
 * the `./internal` entry point; everything else should not depend on them.
 *
 * See ADR 015 for the rationale.
 */

// Project loading — the canonical entry point consumers start from.
export { loadProject, type ProjectLoader } from "./loader";

// Compilation pipeline — `.test.yml` → `.test.ts` (with progress events).
export {
  compile,
  compileProgress,
  type CompileEvent,
  type CompileResult,
  type CompilerOptions,
} from "./compiler/compiler";

// Extraction of already-compiled task code from a `.test.ts` file.
export { getNodeGeneratedCode } from "./compiler/extract-generated-code";

// Test execution — runs a compiled file path against a real browser.
export { execute } from "./test-run";

// Runner contract, event union, and options — all defined in `./types`.
export type {
  ExecuteOptions,
  Runner,
  RunnerEvent,
  RunnerResult,
  RunnerState,
} from "./types";

// The `TestAPI` type — the surface that compiled task code may call.
// Emitted into generated `.test.ts` source as `import type { TestAPI }`.
export type { TestAPI } from "./types";
