import * as fs from "fs";
import * as path from "path";
import { compileCodeToFunction as compileVM } from "@thani-sh/duct-tape";
import type { Page } from "playwright";
import type { Task, Path, Project, ExecutableTask } from "@libs/domain";
import { loadProject } from "../loader";
import { execute } from "../test-run";
import { expect } from "@playwright/test";
import type { GroundingContext, TestAPI } from "../types";
import { launchBrowserSession, type BrowserSession } from "../browser";
import { saveScreenshotToTmp } from "../screenshot";

/**
 * CompilerGroundingSession manages a stateful browser page session that persists across task generations.
 */
export class CompilerGroundingSession {
  private session: BrowserSession | null = null;
  private headless: boolean = true;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  async getPage(): Promise<Page> {
    if (!this.session) {
      this.session = await launchBrowserSession({ headless: this.headless });
    }
    return this.session.page;
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
  }
}

// Compiles a string of Javascript/TypeScript task function into an executable in-memory function
export function compileCodeToFunction(
  codeStr: string,
  tasksObj: Record<string, (api: TestAPI) => Promise<void>>,
): (api: TestAPI) => Promise<void> {
  let cleanCode = codeStr.replace(/\(api:\s*TestAPI\)/g, "(api)").trim();
  return compileVM<Promise<void>, [TestAPI]>(cleanCode, { tasks: tasksObj });
}

// Spawns Playwright test execution on the prefix path to acquire grounding DOM and screenshot context
export async function runGroundingSandbox(
  targetFilePath: string,
  nodeId: string,
  node: Task,
  prefixNodeIds: string[],
  currentCodeBody: string,
  compiledTasksCache: Map<string, { code: string; title: string }>,
  upToTaskId: string,
  existingPage?: Page,
): Promise<{ error: unknown; context: GroundingContext | null }> {
  let executionError: unknown = null;
  let groundingContext: GroundingContext | null = null;

  try {
    // Load project configuration variables
    let variables: Record<string, unknown> = {};
    let project: any = null;
    try {
      project = await loadProject(targetFilePath);
      variables = project.variables || {};
    } catch (e) {
      // Ignore
    }

    // Build tasks mapping for sandbox context
    const sandboxTasks: Record<string, (api: TestAPI) => Promise<void>> = {};
    const allNodeIds = [...prefixNodeIds, nodeId];

    // Compile prefix nodes in order
    prefixNodeIds.forEach((pid) => {
      const cached = compiledTasksCache.get(pid);
      if (cached) {
        sandboxTasks[pid] = compileCodeToFunction(cached.code, sandboxTasks);
      }
    });

    // Compile the current target node code
    const currentCodeWrapped = `async (api: TestAPI) => {\n${currentCodeBody}\n}`;
    sandboxTasks[nodeId] = compileCodeToFunction(
      currentCodeWrapped,
      sandboxTasks,
    );

    // Construct linear in-memory execution Path
    const tasksList: Task[] = allNodeIds.map((nid) => {
      const t = nid === nodeId ? node : { title: "prefix", info: "" };
      const executableTask: ExecutableTask<TestAPI> = {
        id: nid,
        title: t.title,
        info: t.info || "",
        next: [],
        execute: sandboxTasks[nid]!,
      };
      return executableTask;
    });

    const primaryPath: Path = { tasks: tasksList };

    const runner = await execute(primaryPath, {
      upToTaskId,
      headless: true,
      variables,
      existingPage,
      provarPath: project ? project.path : undefined,
    });

    for await (const event of runner.events()) {
      if (event.type === "task-failed" && event.taskId === upToTaskId) {
        executionError = event.error;
      }
    }

    const state = runner.getState();
    const errors = state.errors.filter((e) => e.taskId === upToTaskId);
    if (errors.length > 0) {
      executionError = errors[0]?.error;
    }

    // Capture dynamic grounding context
    const page =
      existingPage ||
      (runner as unknown as { activePage: Page | null }).activePage;
    if (page) {
      try {
        const pageContent = await page.content();
        let screenshot: string | undefined;
        try {
          const buf = await page.screenshot({ type: "png" });
          screenshot = saveScreenshotToTmp(buf, `compile-${nodeId}`);
        } catch (e) {}
        groundingContext = { pageContent, screenshot };
      } catch (e) {}
    } else {
      // Runner closed, fetch cached context from state nested fields
      const pageContent = state.pageContent;
      const screenshot = state.pageScreenshot;
      if (pageContent || screenshot) {
        groundingContext = { pageContent, screenshot };
      }
    }
  } catch (err: unknown) {
    executionError = err;
  }

  return {
    error: executionError,
    context: groundingContext,
  };
}
