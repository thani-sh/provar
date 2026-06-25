import { describe, expect, test } from "bun:test";
import {
  MUTATING_METHODS,
  MutationTrackingPage,
} from "../runtime/mutation-tracking-page";
import type { Page } from "playwright";

/**
 * Build a fake Playwright Page that exposes the mutating methods we want to
 * track. Each method resolves to a sentinel value and appends to `calls` so
 * tests can assert that delegation happened.
 */
function fakePage() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const page: Record<string, unknown> = {};
  for (const method of MUTATING_METHODS) {
    page[method] = async (...args: unknown[]) => {
      calls.push({ method, args });
      return `result:${method}`;
    };
  }
  // Non-mutating read method used by the delegate-escape-hatch test.
  page["url"] = async () => "https://x";
  return { page: page as unknown as Page, calls };
}

describe("MutationTrackingPage", () => {
  test("starts unmutated and undisposed", () => {
    const { page } = fakePage();
    const tracker = new MutationTrackingPage(page);
    expect(tracker.mutated).toBe(false);
    expect(tracker.wasDisposed).toBe(false);
    expect(tracker.delegate).toBe(page);
    tracker.dispose();
  });

  test("flips mutated to true after a tracked call", async () => {
    const { page, calls } = fakePage();
    const tracker = new MutationTrackingPage(page);

    expect(tracker.mutated).toBe(false);
    const click = tracker.click as unknown as (
      selector: string,
    ) => Promise<string>;
    const result = await click("button.cta");
    expect(result).toBe("result:click");
    expect(tracker.mutated).toBe(true);
    expect(calls).toEqual([{ method: "click", args: ["button.cta"] }]);

    tracker.dispose();
  });

  test("keeps mutated=true once flipped (sticky flag)", async () => {
    const { page } = fakePage();
    const tracker = new MutationTrackingPage(page);
    const t = tracker as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    await t["click"]!("a");
    expect(tracker.mutated).toBe(true);
    // Subsequent calls don't reset it.
    await t["fill"]!("input", "x");
    expect(tracker.mutated).toBe(true);
    tracker.dispose();
  });

  test("exposes a tracked wrapper for every MUTATING_METHOD", () => {
    const { page } = fakePage();
    const tracker = new MutationTrackingPage(page);
    for (const method of MUTATING_METHODS) {
      const fn = (tracker as unknown as Record<string, unknown>)[method];
      expect(typeof fn).toBe("function");
    }
    tracker.dispose();
  });

  test("tracked methods forward all arguments to the delegate", async () => {
    const { page, calls } = fakePage();
    const tracker = new MutationTrackingPage(page);
    // Page methods are heavily overloaded in Playwright; cast to a plain
    // variadic signature for the test.
    const t = tracker as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    await t["fill"]!('input[name="email"]', "a@b.c");
    await t["press"]!("Enter");
    await t["goto"]!("https://example.com");
    await t["selectOption"]!("select#x", "v");
    await t["hover"]!("div");
    await t["dblclick"]!("p");
    await t["check"]!("input[type=checkbox]");
    await t["uncheck"]!("input[type=checkbox]");
    await t["type"]!("textarea", "hello");
    expect(calls.map((c) => c.method)).toEqual([
      "fill",
      "press",
      "goto",
      "selectOption",
      "hover",
      "dblclick",
      "check",
      "uncheck",
      "type",
    ]);
    tracker.dispose();
  });

  test("dispose() makes subsequent tracked calls throw", async () => {
    const { page } = fakePage();
    const tracker = new MutationTrackingPage(page);
    tracker.dispose();
    expect(tracker.wasDisposed).toBe(true);
    let caught: unknown = null;
    try {
      const click = tracker.click as unknown as (
        selector: string,
      ) => Promise<string>;
      await click("button");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/after dispose/);
  });

  test("the delegate reference is preserved (read-only escape hatch)", async () => {
    const { page, calls } = fakePage();
    const tracker = new MutationTrackingPage(page);
    expect(tracker.delegate).toBe(page);
    // .delegate exposes the unwrapped page, so callers can still read
    // things like `tracker.delegate.url()` without flipping mutated.
    expect(typeof tracker.delegate.url).toBe("function");
    await tracker.delegate.url();
    // The unwrapped call did not go through the tracker, so the click
    // list is empty — and the mutated flag stays false.
    expect(calls).toEqual([]);
    expect(tracker.mutated).toBe(false);
    tracker.dispose();
  });
});
