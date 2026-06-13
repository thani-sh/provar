import type { Page } from "playwright";

/**
 * MUTATING_METHODS lists the Playwright Page methods whose invocation indicates
 * the page DOM has been modified by a task. Any call to one of these methods
 * flips the MutationTrackingPage's `mutated` flag.
 */
export const MUTATING_METHODS = [
  "click",
  "fill",
  "type",
  "press",
  "goto",
  "check",
  "uncheck",
  "selectOption",
  "hover",
  "dblclick",
] as const;

export type MutatingMethod = (typeof MUTATING_METHODS)[number];

/**
 * MutationTrackingPage is a thin, deterministic wrapper around a Playwright
 * `Page` that tracks whether any mutating method has been invoked on it.
 *
 * It replaces the previous monkey-patching approach (see BUG-1) where the
 * runner and compiler mutated `page[method]` at runtime — which leaked across
 * runs, double-wrapped on reuse, and could not be torn down deterministically.
 *
 * Usage:
 *   const tracker = new MutationTrackingPage(page);
 *   await tracker.delegate.click("...");
 *   tracker.mutated === true;
 *   tracker.dispose();
 */
export class MutationTrackingPage {
  /**
   * delegate is the wrapped Playwright page, exposed for callers that need
   * direct read access (e.g. `tracker.delegate.content()`). Prefer calling
   * the tracked wrappers instead.
   */
  readonly delegate: Page;

  private _mutated = false;
  private _disposed = false;

  constructor(page: Page) {
    this.delegate = page;
  }

  /**
   * mutated reports whether any mutating method has been called on this tracker.
   * Once flipped, it stays true for the lifetime of the tracker.
   */
  get mutated(): boolean {
    return this._mutated;
  }

  /**
   * get wasDisposed reports whether `dispose()` has been called.
   */
  get wasDisposed(): boolean {
    return this._disposed;
  }

  /**
   * track wraps a single method call so the mutated flag is set when invoked.
   */
  private track<Args extends unknown[]>(
    method: MutatingMethod,
    fn: (...args: Args) => Promise<unknown>,
  ): (...args: Args) => Promise<unknown> {
    if (this._disposed) {
      throw new Error(
        `MutationTrackingPage.${method}() called after dispose(). ` +
          `Create a new tracker around a fresh page.`,
      );
    }
    return async (...args: Args) => {
      this._mutated = true;
      return fn(...args);
    };
  }

  /**
   * click delegates to the underlying page, flipping the mutation flag.
   */
  click: Page["click"] = ((...args: Parameters<Page["click"]>) =>
    this.track(
      "click",
      this.delegate.click.bind(this.delegate),
    )(...args)) as Page["click"];

  /**
   * fill delegates to the underlying page, flipping the mutation flag.
   */
  fill: Page["fill"] = ((...args: Parameters<Page["fill"]>) =>
    this.track(
      "fill",
      this.delegate.fill.bind(this.delegate),
    )(...args)) as Page["fill"];

  /**
   * type delegates to the underlying page, flipping the mutation flag.
   */
  type: Page["type"] = ((...args: Parameters<Page["type"]>) =>
    this.track(
      "type",
      this.delegate.type.bind(this.delegate),
    )(...args)) as Page["type"];

  /**
   * press delegates to the underlying page, flipping the mutation flag.
   */
  press: Page["press"] = ((...args: Parameters<Page["press"]>) =>
    this.track(
      "press",
      this.delegate.press.bind(this.delegate),
    )(...args)) as Page["press"];

  /**
   * goto delegates to the underlying page, flipping the mutation flag.
   */
  goto: Page["goto"] = ((...args: Parameters<Page["goto"]>) =>
    this.track(
      "goto",
      this.delegate.goto.bind(this.delegate),
    )(...args)) as Page["goto"];

  /**
   * check delegates to the underlying page, flipping the mutation flag.
   */
  check: Page["check"] = ((...args: Parameters<Page["check"]>) =>
    this.track(
      "check",
      this.delegate.check.bind(this.delegate),
    )(...args)) as Page["check"];

  /**
   * uncheck delegates to the underlying page, flipping the mutation flag.
   */
  uncheck: Page["uncheck"] = ((...args: Parameters<Page["uncheck"]>) =>
    this.track(
      "uncheck",
      this.delegate.uncheck.bind(this.delegate),
    )(...args)) as Page["uncheck"];

  /**
   * selectOption delegates to the underlying page, flipping the mutation flag.
   */
  selectOption: Page["selectOption"] = ((
    ...args: Parameters<Page["selectOption"]>
  ) =>
    this.track(
      "selectOption",
      this.delegate.selectOption.bind(this.delegate),
    )(...args)) as Page["selectOption"];

  /**
   * hover delegates to the underlying page, flipping the mutation flag.
   */
  hover: Page["hover"] = ((...args: Parameters<Page["hover"]>) =>
    this.track(
      "hover",
      this.delegate.hover.bind(this.delegate),
    )(...args)) as Page["hover"];

  /**
   * dblclick delegates to the underlying page, flipping the mutation flag.
   */
  dblclick: Page["dblclick"] = ((...args: Parameters<Page["dblclick"]>) =>
    this.track(
      "dblclick",
      this.delegate.dblclick.bind(this.delegate),
    )(...args)) as Page["dblclick"];

  /**
   * dispose marks the tracker as torn down. Subsequent calls to mutating
   * methods throw a descriptive error. The wrapped page is released so the
   * caller (or `browser.close()`) is the sole owner of the underlying object.
   */
  dispose(): void {
    this._disposed = true;
  }
}
