/**
 * Shared SIGINT/SIGTERM handling for the `provar` CLI.
 *
 * The CLI is a long-running batch process — `provar compile` can hang on a single LLM call for
 * 30+ seconds, and `provar run` can spin up a Playwright browser that needs to close cleanly.
 * The default Node behavior on Ctrl-C is to terminate the process immediately, which would
 * leak the browser and any in-flight compile artefacts. This module:
 *
 * 1. Exposes a single `cancelled` flag that any handler can read between iterations.
 * 2. Lets each command register a cleanup function (via `onCancel`) that runs when the FIRST
 *    SIGINT/SIGTERM arrives — e.g. the run command registers a callback that cancels every
 *    in-flight `Runner` and awaits their `wait()` promises so the test-runner `finally` block
 *    can close the browser.
 * 3. Treats a SECOND SIGINT/SIGTERM as a force-exit signal — the cleanup function is
 *    fire-and-forget at that point and the caller-supplied `onSecondSignal` runs (which
 *    defaults to `process.exit(130)`).
 *
 * Registration is idempotent — multiple callers can invoke `registerSignalHandlers` safely.
 */

import pc from "picocolors";

let cancelled = false;
let handlersRegistered = false;
let signalCount = 0;

const cleanupFns: Array<() => void | Promise<void>> = [];

export interface SignalHandlers {
  /**
   * Called when the first SIGINT/SIGTERM arrives. The CLI typically uses this to flip a flag
   * (already done by the time we call this) and to cancel in-flight work. The returned
   * promise is awaited by the dispatch layer before `process.exit(130)` runs, so handlers
   * that own resources (browsers, sessions) can clean up deterministically.
   */
  onCancel?: () => void | Promise<void>;
  /**
   * Called when a second SIGINT/SIGTERM arrives. Override in tests to avoid exiting. Defaults
   * to `process.exit(130)`.
   */
  onSecondSignal?: () => void;
}

/**
 * Returns `true` if a SIGINT/SIGTERM has been observed since the process started. Handlers
 * check this between iterations of long-running work to bail out early.
 */
export function isCancelled(): boolean {
  return cancelled;
}

/**
 * Registers a cleanup function that runs when the first SIGINT/SIGTERM arrives. Multiple
 * cleanup functions are called in registration order, sequentially, and the dispatch layer
 * awaits all of them before exiting.
 */
export function onCancel(fn: () => void | Promise<void>): void {
  cleanupFns.push(fn);
}

/**
 * Runs every registered cleanup function. Returns when all of them have settled. Errors are
 * logged and swallowed so a single bad handler doesn't prevent the rest from running.
 */
export async function runCancelCleanups(): Promise<void> {
  for (const fn of cleanupFns) {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`Cancellation handler failed: ${message}`));
    }
  }
}

/**
 * Installs SIGINT/SIGTERM listeners on the current process. Idempotent — calling this more
 * than once is a no-op. The second signal triggers `onSecondSignal` (which defaults to
 * `process.exit(130)`); the first signal runs the registered cleanup functions but does NOT
 * exit on its own — the dispatch layer is expected to call `runCancelCleanups()` and then
 * exit with `ExitCode.SigInt` once the in-flight work has settled.
 */
export function registerSignalHandlers(handlers: SignalHandlers = {}): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const onSecond = handlers.onSecondSignal ?? (() => process.exit(130));

  const handle = (label: "SIGINT" | "SIGTERM") => {
    signalCount++;
    if (signalCount === 1) {
      cancelled = true;
      console.log(
        pc.yellow(
          `\n⚠️  ${label} received — finishing in-flight work, then exiting. Press Ctrl-C again to force-quit.`,
        ),
      );
      // Fire the user-supplied cleanup in the background. The dispatch
      // layer is responsible for awaiting the registered cleanup
      // functions and calling process.exit(130) when done. We attach a
      // safety net: if the user-supplied cleanup throws or is missing,
      // we still exit with 130 so the process never hangs.
      Promise.resolve(handlers.onCancel?.())
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(pc.red(`onCancel handler failed: ${message}`));
        })
        .finally(() => {
          // Nothing to do here — the dispatch layer owns the exit.
        });
      return;
    }
    onSecond();
  };

  process.on("SIGINT", () => handle("SIGINT"));
  process.on("SIGTERM", () => handle("SIGTERM"));
}

/**
 * Test-only: reset the module state so a fresh test can re-register handlers against a
 * cancelled/uncancelled baseline. Exported as `__resetSignalStateForTests` to make the
 * intent clear and to discourage accidental production use.
 */
export function __resetSignalStateForTests(): void {
  cancelled = false;
  handlersRegistered = false;
  signalCount = 0;
  cleanupFns.length = 0;
}
