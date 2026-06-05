import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import { type Browser, type Page, chromium } from "playwright";
import { expect } from "@playwright/test";
import type { Path, Task } from "@libs/domain";
import type {
  TestAPI,
  Runner,
  RunnerState,
  RunnerEvent,
  RunnerResult,
  ExecuteOptions,
} from "./types";

export class PathRunner implements Runner {
  private state: RunnerState = {
    status: "idle",
    errors: [],
    pageMutated: false,
  };
  private eventQueue: RunnerEvent[] = [];
  private resolveNextEvent:
    | ((value: IteratorResult<RunnerEvent>) => void)
    | null = null;
  private isFinished = false;
  private browser: Browser | null = null;
  private activePage: Page | null = null;

  private resumeSignal: { resolve: () => void; promise: Promise<void> } | null =
    null;
  private cancelSignal = false;
  private startTime = 0;

  private waitResolve: ((value: RunnerResult) => void) | null = null;
  private waitPromise: Promise<RunnerResult>;

  constructor(
    private path: Path,
    private options: ExecuteOptions = {},
  ) {
    let resolveFn: any;
    this.waitPromise = new Promise<RunnerResult>((resolve) => {
      resolveFn = resolve;
    });
    this.waitResolve = resolveFn;
  }

  getState(): RunnerState {
    const elapsed = this.startTime
      ? Math.round(Date.now() - this.startTime)
      : 0;
    return {
      ...this.state,
      elapsed,
    };
  }

  async *events(): AsyncGenerator<RunnerEvent, void> {
    while (!this.isFinished || this.eventQueue.length > 0) {
      if (this.eventQueue.length > 0) {
        yield this.eventQueue.shift()!;
      } else {
        const nextPromise = new Promise<IteratorResult<RunnerEvent>>(
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

  private pushEvent(event: RunnerEvent) {
    this.updateState(event);
    if (this.resolveNextEvent) {
      const resolve = this.resolveNextEvent;
      this.resolveNextEvent = null;
      resolve({ value: event, done: false });
    } else {
      this.eventQueue.push(event);
    }
  }

  private updateState(event: RunnerEvent) {
    switch (event.type) {
      case "run-started":
        this.state.status = "running";
        break;
      case "task-started":
        this.state.current = event.taskId;
        break;
      case "task-finished":
        this.state.current = undefined;
        break;
      case "task-failed":
        this.state.errors.push({
          taskId: event.taskId,
          error: event.error,
        });
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

  async pause(): Promise<void> {
    if (this.state.status !== "running") return;

    // Set up standard deferred signal promise
    let resolveFn: any;
    const promise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });

    this.resumeSignal = {
      resolve: resolveFn,
      promise,
    };

    this.state.status = "paused";
    // We emit run-finished with status paused as an event
    this.pushEvent({ type: "run-finished", status: "paused" });
    this.state.status = "paused";
  }

  async resume(): Promise<void> {
    if (this.state.status !== "paused") return;
    this.state.status = "running";
    this.pushEvent({ type: "run-started" });
    this.resumeSignal?.resolve();
    this.resumeSignal = null;
  }

  async cancel(): Promise<void> {
    this.cancelSignal = true;
    if (this.state.status === "paused") {
      this.resumeSignal?.resolve();
    }
  }

  async wait(): Promise<RunnerResult> {
    return this.waitPromise;
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    this.pushEvent({ type: "run-started" });

    let runSuccess = true;
    try {
      let page: Page;
      if (this.options.existingPage) {
        page = this.options.existingPage;
        this.activePage = page;
      } else {
        this.browser = await chromium.launch({
          headless: this.options.headless !== false,
        });
        const context = await this.browser.newContext();
        page = await context.newPage();
        this.activePage = page;
      }

      const mutatingMethods = [
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
      ];
      mutatingMethods.forEach((method) => {
        if (typeof (page as any)[method] === "function") {
          const original = (page as any)[method].bind(page);
          (page as any)[method] = async (...args: any[]) => {
            const res = await original(...args);
            this.state.pageMutated = true;
            return res;
          };
        }
      });

      const api: TestAPI = {
        page,
        var: this.options.variables || {},
        state: {},
        expect,
      };

      for (const task of this.path.tasks) {
        if (this.cancelSignal) {
          this.state.status = "cancelled";
          runSuccess = false;
          break;
        }

        // Task Boundary Pause checkpoint
        if (this.state.status === "paused" && this.resumeSignal) {
          await this.resumeSignal.promise;
        }

        if (this.cancelSignal) {
          this.state.status = "cancelled";
          runSuccess = false;
          break;
        }

        this.pushEvent({
          type: "task-started",
          taskId: task.id,
          title: task.title,
        });

        // Capture visual screenshot of the step for audit logs and AI grounding (always enabled by default)
        try {
          const buf = await page.screenshot({ type: "png" });
          this.pushEvent({
            type: "visual-comparison-triggered",
            taskId: task.id,
            screenshotBase64: buf.toString("base64"),
            visualCompare: task.config?.visualCompare === true,
          });
        } catch (e) {
          // Ignore screenshot capture/trigger failures
        }

        // Execute dynamic task bindings
        try {
          const executableTask = task as Task & {
            execute: (api: TestAPI) => Promise<void>;
          };
          if (typeof executableTask.execute !== "function") {
            throw new Error(
              `Task '${task.id}' does not have a compiled execute function bound.`,
            );
          }
          await executableTask.execute(api);
          this.pushEvent({
            type: "task-finished",
            taskId: task.id,
          });
        } catch (err: any) {
          runSuccess = false;
          this.pushEvent({
            type: "task-failed",
            taskId: task.id,
            error: err,
          });
          break;
        }

        if (this.options.upToTaskId && task.id === this.options.upToTaskId) {
          break;
        }
      }
    } catch (err: any) {
      runSuccess = false;
      this.pushEvent({
        type: "task-failed",
        taskId: this.state.current || "unknown",
        error: err,
      });
    } finally {
      if (this.activePage && !this.options.existingPage) {
        try {
          this.state.pageContent = await this.activePage.content();
          const buf = await this.activePage.screenshot({ type: "png" });

          const screenshotsDir = path.resolve(
            process.cwd(),
            ".provar/screenshots",
          );
          fs.mkdirSync(screenshotsDir, { recursive: true });
          const fileName = `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
          const filePath = path.join(screenshotsDir, fileName);
          fs.writeFileSync(filePath, buf);

          this.state.pageScreenshot = filePath;
        } catch (e) {
          // Ignore
        }
      }

      if (this.browser && !this.options.existingPage) {
        await this.browser.close();
        this.browser = null;
        this.activePage = null;
      }

      let finalStatus: RunnerState["status"] = "success";
      if (this.cancelSignal) {
        finalStatus = "cancelled";
      } else if (!runSuccess || this.state.errors.length > 0) {
        finalStatus = "failed";
      }

      this.pushEvent({
        type: "run-finished",
        status: finalStatus,
      });

      const result: RunnerResult = {
        status: finalStatus as any,
        errors: this.state.errors,
      };
      this.waitResolve?.(result);
    }
  }
}

export async function execute(
  path: Path,
  options?: ExecuteOptions,
): Promise<Runner> {
  const runner = new PathRunner(path, options);
  runner.start().catch((e) => {
    console.error("[Executor Path Runner Error]", e);
  });
  return runner;
}
