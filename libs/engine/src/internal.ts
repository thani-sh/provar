/**
 * Internal barrel for `@libs/engine`.
 *
 * This entry point is intentionally NOT part of the engine's public surface.
 * It exists for:
 *
 *   - Engine-internal modules that need to reach sibling helpers (e.g.
 *     `compiler.ts` imports `groundAndGenerateTask` from `./compiler/generator`).
 *   - Adjacent test files in `__tests__/` that exercise helpers which the
 *     engine consumes internally (e.g. `cleanCode`, `MUTATING_METHODS`).
 *
 * External applications (`apps/provar-app`, `apps/provar-cli`) MUST NOT import
 * from `@libs/engine/internal`. Anything they need belongs in the curated
 * `./index.ts` public surface.
 *
 * If you find yourself wanting to add a new internal export here, first ask:
 * "Is this part of the engine's external contract?" If yes, it goes in
 * `./index.ts`. If you do not know, prefer adding it to `./index.ts` only
 * after a consumer in `apps/` actually needs it.
 *
 * See ADR 015 for the rationale.
 */

// Browser session — launched internally by `execute()` and the grounding sandbox.
export { launchBrowserSession, type BrowserSession } from "./browser";

// On-disk screenshot staging — used by `PathRunner` and `CompilerGroundingSession`.
export { saveScreenshotToTmp } from "./screenshot";

// Project loading helpers — `loadProject` itself is public; these are its
// internal building blocks and the static analyser for `.test.yml` files.
export { buildGraphPaths, parseTestFile } from "./loader";

// The runner class — `execute()` is the public function; `PathRunner` is the
// long-lived engine that the webview/CLI bind to for pause/resume/cancel.
export { PathRunner } from "./test-run";

// Compilation helpers — used by `compileProgress` and the self-healing executor.
export {
  CompilerGroundingSession,
  cleanCode,
  groundAndGenerateTask,
} from "./compiler/generator";
export { compileCodeToFunction, runGroundingSandbox } from "./compiler/sandbox";

// Compilation performance tracker — emits `.trace.json` artifacts.
export {
  CompilerPerformanceTracker,
  type CompilationTrace,
  type TaskTelemetry,
} from "./compiler/tracker";

// Internal types — `GroundingContext` describes the sandbox state passed
// between `compileProgress`, the grounding session, and the AI agent.
export type { GroundingContext } from "./types";

// Page-mutation tracking — used by `PathRunner` to detect visual changes for
// the visual-diff subsystem. The class is re-exported from the engine barrel
// for backwards compatibility with consumers that reach into the runtime
// helper directly.
export {
  MUTATING_METHODS,
  MutationTrackingPage,
  type MutatingMethod,
} from "./runtime/mutation-tracking-page";

// Re-export `expect` from `@playwright/test` so engine code (and tests) that
// need Playwright's matcher API do not have to add a second import path.
export { expect } from "@playwright/test";
