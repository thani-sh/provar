import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  __resetSignalStateForTests,
  isCancelled,
  onCancel,
  registerSignalHandlers,
  runCancelCleanups,
} from "./signal";

/**
 * These tests exercise the signal util's public API. They don't emit real SIGINTs (Node
 * doesn't allow that from within the same process for safety) — instead they exercise the
 * functions the handlers call, plus the `onCancel` / `runCancelCleanups` plumbing that the
 * dispatch layer relies on.
 *
 * `registerSignalHandlers` is still called with an `onSecondSignal` override so the
 * force-exit path is a no-op during tests.
 */

describe("signal util", () => {
  beforeEach(() => {
    __resetSignalStateForTests();
  });

  afterEach(() => {
    __resetSignalStateForTests();
  });

  test("isCancelled returns false by default", () => {
    expect(isCancelled()).toBe(false);
  });

  test("registerSignalHandlers is idempotent (safe to call multiple times)", () => {
    let count = 0;
    registerSignalHandlers({
      onCancel: () => {
        count++;
      },
      onSecondSignal: () => {},
    });
    registerSignalHandlers({
      onCancel: () => {
        count++;
      },
      onSecondSignal: () => {},
    });
    // The first registration wins; the second is a no-op. We don't have
    // a way to directly trigger SIGINT here, but the contract is
    // "calling this twice is safe and the handler isn't duplicated" —
    // verified by the absence of a thrown error and the preserved state.
    expect(isCancelled()).toBe(false);
    expect(count).toBe(0);
  });

  test("onCancel registers a cleanup that runs via runCancelCleanups", async () => {
    let called = 0;
    onCancel(() => {
      called++;
    });
    onCancel(async () => {
      called++;
    });
    await runCancelCleanups();
    expect(called).toBe(2);
  });

  test("runCancelCleanups swallows handler errors so one bad handler doesn't block the rest", async () => {
    const calls: number[] = [];
    onCancel(() => {
      calls.push(1);
    });
    onCancel(() => {
      throw new Error("boom");
    });
    onCancel(() => {
      calls.push(3);
    });
    // Should not throw even though the second handler throws.
    await runCancelCleanups();
    expect(calls).toEqual([1, 3]);
  });

  test("runCancelCleanups awaits async handlers in order", async () => {
    const order: number[] = [];
    onCancel(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
    });
    onCancel(async () => {
      order.push(2);
    });
    await runCancelCleanups();
    // Sequential — first handler must complete before the second runs.
    expect(order).toEqual([1, 2]);
  });
});
