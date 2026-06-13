import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import os from "os";
import { type Browser, type Page } from "playwright";
import { expect } from "@playwright/test";
import type { Path, Task, ExecutableTask } from "@libs/domain";
import type {
  TestAPI,
  Runner,
  RunnerState,
  RunnerEvent,
  RunnerResult,
  ExecuteOptions,
} from "./types";
import { launchBrowserSession } from "./browser";
import { saveScreenshotToTmp } from "./screenshot";
import { StepRunner, type Step } from "@thani-sh/taskmaster";
import {
  createAsyncIterable,
  type AsyncIterableController,
} from "@thani-sh/iterables";

/**
 * PathRunner executes a linear sequence of tasks representing a single test path.
 */
export class PathRunner implements Runner {
  private state: RunnerState = {
    status: "idle",
    errors: [],
    pageMutated: false,
  };
  private browser: Browser | null = null;
  public activePage: Page | null = null;

  private startTime = 0;
  private controller: AsyncIterableController<RunnerEvent>;
  private taskmasterRunner: StepRunner<TestAPI> | null = null;

  private waitResolve: ((value: RunnerResult) => void) | null = null;
  private waitPromise: Promise<RunnerResult>;

  constructor(
    private path: Path,
    private options: ExecuteOptions = {},
  ) {
    this.controller = createAsyncIterable<RunnerEvent>();
    let resolveFn: (value: RunnerResult) => void = () => {};
    this.waitPromise = new Promise<RunnerResult>((resolve) => {
      resolveFn = resolve;
    });
    this.waitResolve = resolveFn;
  }

  getState(): RunnerState {
    const elapsed = this.startTime
      ? Math.round(Date.now() - this.startTime)
      : 0;

    const tmState = this.taskmasterRunner?.getState();
    const status = tmState
      ? (tmState.status as RunnerState["status"])
      : this.state.status;
    const current = tmState ? tmState.currentStepId : this.state.current;

    return {
      ...this.state,
      status,
      current,
      elapsed,
    };
  }

  events(): AsyncGenerator<RunnerEvent, void> {
    return this.controller.iterable;
  }

  private pushEvent(event: RunnerEvent) {
    this.updateState(event);
    this.controller.push(event);
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
          error:
            event.error instanceof Error
              ? event.error
              : new Error(String(event.error)),
        });
        break;
      case "run-finished":
        this.state.status = event.status;
        break;
    }
  }

  async pause(): Promise<void> {
    await this.taskmasterRunner?.pause();
  }

  async resume(): Promise<void> {
    await this.taskmasterRunner?.resume();
  }

  async cancel(): Promise<void> {
    await this.taskmasterRunner?.cancel();
  }

  async wait(): Promise<RunnerResult> {
    return this.waitPromise;
  }

  async start(): Promise<void> {
    this.startTime = Date.now();

    let runSuccess = true;
    try {
      let page: Page;
      if (this.options.existingPage) {
        page = this.options.existingPage;
        this.activePage = page;
      } else {
        const session = await launchBrowserSession({
          headless: this.options.headless !== false,
        });
        this.browser = session.browser;
        page = session.page;
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
      ] as const;

      const pageRecord = page as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      mutatingMethods.forEach((method) => {
        const original = pageRecord[method];
        if (typeof original === "function") {
          const boundOriginal = original.bind(page);
          pageRecord[method] = async (...args: unknown[]) => {
            const res = await boundOriginal(...args);
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

      const steps: Step<TestAPI>[] = this.path.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        execute: async ({ context, emitCustomEvent }) => {
          const executableTask = task as ExecutableTask<TestAPI>;
          if (typeof executableTask.execute !== "function") {
            throw new Error(
              `Task '${task.id}' does not have a compiled execute function bound.`,
            );
          }
          await executableTask.execute(context);

          try {
            const buf = await context.page.screenshot({ type: "png" });
            emitCustomEvent("visual-comparison-triggered", {
              screenshotBase64: buf.toString("base64"),
              visualCompare: task.config?.visualCompare === true,
            });
          } catch (e) {
            // Ignore screenshot capture/trigger failures
          }
        },
      }));

      const taskmasterRunner = new StepRunner<TestAPI>(
        { steps },
        {
          context: api,
          upToStepId: this.options.upToTaskId,
        },
      );
      this.taskmasterRunner = taskmasterRunner;

      // Asynchronously handle events from taskmaster and stream them
      (async () => {
        for await (const event of taskmasterRunner.events()) {
          switch (event.type) {
            case "sequence-started":
              this.pushEvent({ type: "run-started" });
              break;
            case "step-started":
              this.pushEvent({
                type: "task-started",
                taskId: event.stepId,
                title: event.title,
              });
              break;
            case "step-finished":
              this.pushEvent({
                type: "task-finished",
                taskId: event.stepId,
              });
              break;
            case "step-failed":
              this.pushEvent({
                type: "task-failed",
                taskId: event.stepId,
                error: event.error,
              });
              break;
            case "step-custom":
              if (event.eventName === "visual-comparison-triggered") {
                const payload = event.payload as {
                  screenshotBase64: string;
                  visualCompare: boolean;
                };
                this.pushEvent({
                  type: "visual-comparison-triggered",
                  taskId: event.stepId,
                  screenshotBase64: payload.screenshotBase64,
                  visualCompare: payload.visualCompare,
                });
              }
              break;
          }
        }
      })().catch((err) => {
        console.error("Error in taskmaster event loop:", err);
      });

      await taskmasterRunner.start();
      const tmResult = await taskmasterRunner.wait();
      runSuccess = tmResult.status === "success";
    } catch (err: unknown) {
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
          const prefix = `run-${crypto.randomUUID().slice(0, 8)}`;
          const filePath = saveScreenshotToTmp(buf, prefix);
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

      const tmState = this.taskmasterRunner?.getState();
      let finalStatus: RunnerState["status"] = "success";
      if (tmState) {
        finalStatus = tmState.status as RunnerState["status"];
      } else if (!runSuccess) {
        finalStatus = "failed";
      }

      this.pushEvent({
        type: "run-finished",
        status: finalStatus,
      });

      const result: RunnerResult = {
        status:
          finalStatus === "success" ||
          finalStatus === "failed" ||
          finalStatus === "cancelled"
            ? finalStatus
            : "failed",
        errors: this.state.errors,
        pageContent: this.state.pageContent,
        pageScreenshot: this.state.pageScreenshot,
        pageMutated: this.state.pageMutated,
      };
      this.waitResolve?.(result);
      this.controller.complete();
    }
  }
}

/**
 * execute begins execution of a test path asynchronously, returning the Runner instance.
 */
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
