import { type Browser, type Page, chromium } from "playwright";
import type {
  TestAPI,
  GroundingContext,
  Action,
  TestDefinition,
  TestRunState,
  TestRunEvent,
  RunTestOptions,
} from "./types";

export class TestRun {
  private state: TestRunState = { status: "idle", errors: [] };
  private eventQueue: TestRunEvent[] = [];
  private resolveNextEvent:
    | ((value: IteratorResult<TestRunEvent>) => void)
    | null = null;
  private isFinished = false;
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private groundingContext: GroundingContext | null = null;

  constructor(private options: RunTestOptions) {}

  getState(): TestRunState {
    return this.state;
  }

  getActivePage(): Page | null {
    return this.activePage;
  }

  getGroundingContext(): GroundingContext | null {
    return this.groundingContext;
  }

  async *events(): AsyncGenerator<TestRunEvent, void, unknown> {
    while (!this.isFinished || this.eventQueue.length > 0) {
      if (this.eventQueue.length > 0) {
        yield this.eventQueue.shift()!;
      } else {
        const nextPromise = new Promise<IteratorResult<TestRunEvent>>(
          (resolve) => {
            this.resolveNextEvent = resolve;
          },
        );
        const result = await nextPromise;
        if (result.done) break;
        yield result.value;
      }
    }
  }

  private pushEvent(event: TestRunEvent) {
    this.updateState(event);
    if (this.resolveNextEvent) {
      const resolve = this.resolveNextEvent;
      this.resolveNextEvent = null;
      resolve({ value: event, done: false });
    } else {
      this.eventQueue.push(event);
    }
  }

  private updateState(event: TestRunEvent) {
    switch (event.type) {
      case "run-started":
        this.state.status = "running";
        break;
      case "test-started":
        this.state.currentTestName = event.testName;
        break;
      case "action-started":
        this.state.currentActionId = event.actionId;
        break;
      case "action-finished":
        this.state.currentActionId = undefined;
        break;
      case "action-failed":
        this.state.errors.push({
          testName: event.testName,
          actionId: event.actionId,
          error: event.error,
        });
        break;
      case "test-finished":
        this.state.currentTestName = undefined;
        break;
      case "run-finished":
        this.state.status = event.status;
        this.isFinished = true;
        if (this.resolveNextEvent) {
          this.resolveNextEvent({ value: undefined, done: true });
        }
        break;
    }
  }

  async start(): Promise<void> {
    this.pushEvent({ type: "run-started" });
    let runSuccess = true;

    try {
      const { tests } = await this.loadTestModule();
      this.browser = await this.initializeBrowser();

      await this.executeTests(tests);
    } catch (err: any) {
      runSuccess = false;
      this.pushEvent({
        type: "action-failed",
        testName: this.state.currentTestName || "unknown",
        actionId: this.state.currentActionId || "unknown",
        error: err,
      });
      throw err;
    } finally {
      await this.cleanup();
      this.pushEvent({
        type: "run-finished",
        status:
          runSuccess && this.state.errors.length === 0 ? "success" : "failed",
      });
    }
  }

  private async loadTestModule(): Promise<{ tests: TestDefinition[] }> {
    // FIXME: We will fix this later.
    const module = await import(this.options.testFilePath);
    return {
      tests: module.tests || [],
    };
  }

  private async initializeBrowser(): Promise<Browser> {
    return await chromium.launch({ headless: this.options.headless !== false });
  }

  private async executeTests(tests: TestDefinition[]): Promise<void> {
    for (const t of tests) {
      if (this.options.testName && t.name !== this.options.testName) {
        continue;
      }
      await this.executeTestPath(t);
    }
  }

  private async executeTestPath(t: TestDefinition): Promise<void> {
    this.pushEvent({ type: "test-started", testName: t.name });

    if (!this.browser) throw new Error("Browser not initialized");
    const context = await this.browser.newContext();
    const page = await context.newPage();
    this.activePage = page;

    const api: TestAPI = {
      page,
      var: this.options.variables || {},
      state: {},
    };

    let testSuccess = true;
    for (const act of t.actions) {
      const actionSucceeded = await this.executeAction(t.name, act, api);
      if (!actionSucceeded) {
        testSuccess = false;
        if (this.options.upToActionId && act.id === this.options.upToActionId) {
          try {
            const pageContent = await page.content();
            let screenshot: string | undefined;
            try {
              const screenshotBuf = await page.screenshot({ type: "png" });
              screenshot = screenshotBuf.toString("base64");
            } catch (e) {
              // Ignore
            }
            this.groundingContext = { pageContent, screenshot };
          } catch (err) {
            // Ignore
          }
        }
        break;
      }

      if (this.options.upToActionId && act.id === this.options.upToActionId) {
        try {
          const pageContent = await page.content();
          let screenshot: string | undefined;
          try {
            const screenshotBuf = await page.screenshot({ type: "png" });
            screenshot = screenshotBuf.toString("base64");
          } catch (e) {
            // Ignore
          }
          this.groundingContext = { pageContent, screenshot };
        } catch (err) {
          // Ignore
        }
        break;
      }
    }

    this.activePage = null;
    await page.close();
    await context.close();

    this.pushEvent({
      type: "test-finished",
      testName: t.name,
      status: testSuccess ? "success" : "failed",
    });
  }

  private async executeAction(
    testName: string,
    act: Action,
    api: TestAPI,
  ): Promise<boolean> {
    this.pushEvent({
      type: "action-started",
      testName,
      actionId: act.id,
      actionTitle: act.title,
    });

    try {
      await act(api);
      this.pushEvent({
        type: "action-finished",
        testName,
        actionId: act.id,
      });
      return true;
    } catch (err: any) {
      this.pushEvent({
        type: "action-failed",
        testName,
        actionId: act.id,
        error: err,
      });
      return false;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export function runTest(options: RunTestOptions): TestRun {
  const tr = new TestRun(options);
  tr.start().catch((e) => {
    console.error(e);
  });
  return tr;
}
