import * as fs from "fs";
import * as path from "path";
import vm from "node:vm";
import os from "os";
import type { Page } from "playwright";
import type { Task, Path } from "@libs/domain";
import { loadProject } from "../loader";
import { execute } from "../TestRun";
import { expect } from "@playwright/test";
import type { GroundingContext } from "../types";
import type { Session, Attachment, Message } from "@libs/models";
import type { CompilerPerformanceTracker } from "./tracker";
import { launchBrowserSession, type BrowserSession } from "../browser";

// Stateful grounding session to preserve browser state across tasks
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

  async close() {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
  }
}

export function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "");
    cleaned = cleaned.replace(/\n```$/, "");
  }
  return cleaned.trim();
}

// Compiles a string of Javascript/TypeScript task function into an executable in-memory function
function compileCodeToFunction(
  codeStr: string,
  tasksObj: any,
): (api: any) => Promise<void> {
  let cleanCode = codeStr.replace(/\(api:\s*TestAPI\)/g, "(api)").trim();

  const wrappedCode = `(${cleanCode})`;
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Buffer,
    tasks: tasksObj,
  };
  const context = vm.createContext(sandbox);
  return vm.runInContext(wrappedCode, context);
}

// Spawns Playwright test execution on the prefix path to acquire grounding DOM and screenshot context
async function runGroundingSandbox(
  targetFilePath: string,
  nodeId: string,
  node: Task,
  prefixNodeIds: string[],
  currentCodeBody: string,
  compiledTasksCache: Map<string, { code: string; title: string }>,
  upToTaskId: string,
  existingPage?: Page,
): Promise<{ error: any; context: GroundingContext | null }> {
  let executionError: any = null;
  let groundingContext: GroundingContext | null = null;

  try {
    // Load project configuration variables
    let variables = {};
    let project: any = null;
    try {
      project = await loadProject(targetFilePath);
      variables = project.variables || {};
    } catch (e) {
      // Ignore
    }

    // Build tasks mapping for sandbox context
    const sandboxTasks: Record<string, (api: any) => Promise<void>> = {};
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
      const executableTask: Task = {
        id: nid,
        title: t.title,
        info: t.info || "",
        next: [],
      };
      (executableTask as any).execute = sandboxTasks[nid];
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
    const page = existingPage || (runner as any).activePage;
    if (page) {
      try {
        const pageContent = await page.content();
        let screenshot: string | undefined;
        try {
          const buf = await page.screenshot({ type: "png" });

          const screenshotsDir = path.join(os.tmpdir(), "provar-screenshots");
          fs.mkdirSync(screenshotsDir, { recursive: true });
          const fileName = `compile-${nodeId}-${Date.now()}.png`;
          const filePath = path.join(screenshotsDir, fileName);
          fs.writeFileSync(filePath, buf);
          screenshot = filePath;
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
  } catch (err: any) {
    executionError = err;
  }

  return {
    error: executionError,
    context: groundingContext,
  };
}

export async function groundAndGenerateTask(
  targetFilePath: string,
  nodeId: string,
  node: Task,
  options: {
    prefixTasks?: string[];
    compiledTasksCache?: Map<string, { code: string; title: string }>;
    session: Session;
    groundingSession?: CompilerGroundingSession;
    tracker?: CompilerPerformanceTracker;
  },
): Promise<string> {
  const prefixNodeIds = options.prefixTasks || [];
  const cache = options.compiledTasksCache || new Map();
  const session = options.session;
  const groundingSession = options.groundingSession;
  const tracker = options.tracker;

  // Load project configuration variables
  let variables: Record<string, any> = {};
  let project: any = null;
  try {
    project = await loadProject(targetFilePath);
    variables = project.variables || {};
  } catch (e) {
    // Ignore
  }

  if (tracker) {
    tracker.initTask(
      nodeId,
      node.title,
      groundingSession ? "STATEFUL" : "SANDBOX",
    );
  }
  const taskStart = tracker ? tracker.startTaskTimer(nodeId) : 0;

  let context: GroundingContext | null = null;

  // Let's get the context using the stateful session if available
  if (groundingSession) {
    try {
      const page = await groundingSession.getPage();
      const currentUrl = page.url();

      if (currentUrl === "about:blank") {
        // Stateful page is fresh/unnavigated. We need to initialize it by running all prefix tasks!
        if (prefixNodeIds.length > 0) {
          console.log(
            `[Stateful Session] Initializing page with prefix tasks...`,
          );
          const lastPrefixId = prefixNodeIds[prefixNodeIds.length - 1]!;
          const sandboxStart = performance.now();
          const sandboxResult = await runGroundingSandbox(
            targetFilePath,
            nodeId,
            node,
            prefixNodeIds,
            "// placeholder",
            cache,
            lastPrefixId,
            page,
          );
          if (tracker) {
            tracker.recordTaskTiming(
              nodeId,
              "sandbox",
              performance.now() - sandboxStart,
            );
          }
          context = sandboxResult.context;
        }
      } else {
        // Page is already navigated! Just capture dynamic context directly (0 sandbox runs)
        console.log(
          `[Stateful Session] Reusing active page state for ${nodeId} (0 sandbox runs)`,
        );
        const pageContent = await page.content();
        let screenshot: string | undefined;
        try {
          const buf = await page.screenshot({ type: "png" });

          const screenshotsDir = path.join(os.tmpdir(), "provar-screenshots");
          fs.mkdirSync(screenshotsDir, { recursive: true });
          const fileName = `compile-${nodeId}-${Date.now()}.png`;
          const filePath = path.join(screenshotsDir, fileName);
          fs.writeFileSync(filePath, buf);
          screenshot = filePath;
        } catch (e) {}
        context = { pageContent, screenshot };
      }
    } catch (err) {
      console.warn(`[Stateful Session Warning] Failed stateful reuse:`, err);
    }
  }

  // Fallback if context is still null and prefix is available
  if (!context && prefixNodeIds.length > 0) {
    if (tracker) {
      tracker.setTaskMode(nodeId, "SANDBOX");
    }
    const lastPrefixId = prefixNodeIds[prefixNodeIds.length - 1]!;
    const sandboxStart = performance.now();
    const sandboxResult = await runGroundingSandbox(
      targetFilePath,
      nodeId,
      node,
      prefixNodeIds,
      "// placeholder",
      cache,
      lastPrefixId,
    );
    if (tracker) {
      tracker.recordTaskTiming(
        nodeId,
        "sandbox",
        performance.now() - sandboxStart,
      );
    }
    context = sandboxResult.context;
  }

  // Generate compiled code body
  let generatedBody = "";
  const agentStart = performance.now();

  let variablesGuideline = "";
  if (Object.keys(variables).length > 0) {
    variablesGuideline = `\n5. Use project variables from the \`api.var\` object when they match values or URLs in the task description, info, or target page. Do NOT hardcode these values.
    Available project variables (reference them as \`api.var.KEY_NAME\`):
    ${JSON.stringify(variables, null, 2)}`;
  }

  const blocks: Attachment[] = [
    {
      type: "text",
      text: `Generate Playwright code inside task:
Title: ${node.title}
Description: ${node.info || "None"}
ID: ${nodeId}

Guidelines for the code:
1. ONLY output the raw JavaScript/TypeScript code inside the task block. Do not include markdown code fences or backticks. Just the code lines.
2. Use api.expect for assertions instead of the global expect or importing it. For example, await api.expect(api.page.locator('body')).toContainText("Expected Text");
3. STRICTLY AVOID using conditional branches (if/else, switch), loops (for, while, each), or try-catch blocks to wrap Playwright actions. If a selector or check fails, it must throw directly to fail the task so it can be handled or healed.
4. Locate elements using this strict priority order:
   - First priority: [data-testid="..."] attributes.
   - Second priority: #id attributes.
   - Third priority: css classes (.class).
   - Fourth priority: text content or ARIA roles (e.g. getByRole, getByText, getByPlaceholder).
   - Only use other custom or complex matchers as a last resort.${variablesGuideline}`,
    },
  ];
  if (context?.pageContent) {
    blocks.push({
      type: "text",
      text: `--- CURRENT DOM STATE ---\n${context.pageContent}`,
    });
  }
  if (context?.screenshot) {
    let base64Data = "";
    try {
      base64Data = fs.readFileSync(context.screenshot).toString("base64");
    } catch (e) {
      console.warn(
        `[Compiler Warning] Failed to read screenshot from disk:`,
        e,
      );
    }

    if (base64Data) {
      blocks.push({
        type: "image",
        data: base64Data,
        mimeType: "image/png",
      });
    }
  }

  let responseText = "";
  for await (const chunk of session.prompt([
    { role: "user", content: blocks },
  ])) {
    if (chunk.type === "text" && chunk.text) {
      responseText += chunk.text;
    }
  }
  generatedBody = cleanCode(responseText);
  if (tracker) {
    tracker.recordTaskTiming(nodeId, "agent", performance.now() - agentStart);
  }

  // Verification & Self-Healing loop
  let finalBody = generatedBody;
  const maxTries = 3;
  let tryCount = 0;
  let success = false;
  let currentCode = generatedBody;

  while (tryCount < maxTries && !success) {
    tryCount++;
    if (tryCount > 1 && tracker) {
      tracker.recordTaskRetry(nodeId);
    }

    console.log(
      `[Self-Healing Loop] Task ${nodeId}: testing candidate try ${tryCount}...`,
    );

    // Fast-path: If stateful session is active, try executing directly on the active page!
    if (groundingSession) {
      let statefulMutated = false;
      const originals = new Map<string, any>();
      let page: Page | null = null;

      try {
        page = await groundingSession.getPage();
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
            originals.set(method, original);
            (page as any)[method] = async (...args: any[]) => {
              const res = await original(...args);
              statefulMutated = true;
              return res;
            };
          }
        });

        const sandboxTasks: Record<string, (api: any) => Promise<void>> = {};

        prefixNodeIds.forEach((pid) => {
          const cached = cache.get(pid);
          if (cached) {
            sandboxTasks[pid] = compileCodeToFunction(
              cached.code,
              sandboxTasks,
            );
          }
        });

        const currentCodeWrapped = `async (api: TestAPI) => {\n${currentCode}\n}`;
        const currentExecFn = compileCodeToFunction(
          currentCodeWrapped,
          sandboxTasks,
        );

        let variables = {};
        try {
          const project = await loadProject(targetFilePath);
          variables = project.variables || {};
        } catch (e) {}

        const api = {
          page,
          var: variables,
          state: {},
          expect,
        };

        const runStart = performance.now();
        try {
          await currentExecFn(api as any);
        } finally {
          // Restore original page methods
          originals.forEach((orig, method) => {
            (page as any)[method] = orig;
          });
        }

        if (tracker) {
          tracker.recordTaskTiming(
            nodeId,
            "sandbox",
            performance.now() - runStart,
          );
        }

        success = true;
        finalBody = currentCode;
        console.log(
          `⚡ [Stateful Fast-Path] Task ${nodeId} executed successfully directly on active page!`,
        );
        break;
      } catch (err: any) {
        // Restore original page methods if catch occurred before finally block executed (e.g. during initialization)
        if (page) {
          originals.forEach((orig, method) => {
            (page as any)[method] = orig;
          });
        }

        console.log(
          `⚠️ [Stateful Fast-Path Fail] Direct execution failed for ${nodeId}: ${err.message || err}`,
        );

        if (statefulMutated) {
          console.log(
            `  [Stateful Session] Tasks were dispatched/performed on the page. Discarding active page state.`,
          );
          await groundingSession.close();
          if (tracker) {
            tracker.setTaskMode(nodeId, "FALLBACK");
          }
        } else {
          console.log(
            `  [Stateful Session] No page interactions were dispatched/performed. Reusing active page state for healing loop!`,
          );
        }
      }
    }

    // Safe-path: Full sandbox execution verify and self-heal
    const sandboxStart = performance.now();
    const testResult = await runGroundingSandbox(
      targetFilePath,
      nodeId,
      node,
      prefixNodeIds,
      currentCode,
      cache,
      nodeId,
    );
    if (tracker) {
      tracker.recordTaskTiming(
        nodeId,
        "sandbox",
        performance.now() - sandboxStart,
      );
    }

    if (!testResult.error) {
      success = true;
      finalBody = currentCode;
      console.log(
        `[Self-Healing Loop] Task ${nodeId} successfully compiled and executed on try ${tryCount}!`,
      );
      break;
    } else {
      console.error(
        `  ⚠️ [Self-Healing Loop] Try ${tryCount} failed for Task ${nodeId}: ${testResult.error?.message || testResult.error}`,
      );
      if (tryCount >= maxTries) {
        console.warn(
          `  ⚠️ [Self-Healing Loop] Max retries reached for Task ${nodeId}. Using last generated code.`,
        );
        if (tracker) {
          tracker.setTaskStatus(nodeId, "FAILED");
        }
        finalBody = currentCode;
        break;
      }

      if (tracker) {
        tracker.setTaskStatus(nodeId, "HEALED");
      }

      const feedbackPrompt = `The generated Playwright code failed execution during grounding checks.
Here is the code you generated:
\`\`\`typescript
${currentCode}
\`\`\`

It threw the following error:
${testResult.error?.message || testResult.error}

Please analyze the error and the new DOM state/screenshot below. Output a corrected, more robust version of the Playwright code block.

STRICTLY follow these constraints in your correction:
1. Address the selector or assertion failure correctly.
2. Do NOT use conditional branches (if/else, switch), loops, or try-catch blocks to hide errors. Let errors throw naturally if they fail.
3. Locate elements using this priority order: [data-testid="..."] -> #id -> .class -> text/ARIA role -> other matchers.
4. Use api.expect for assertions.
5. ONLY output the raw code block (no markdown blocks or fences).${
        Object.keys(variables).length > 0
          ? `\n6. Use project variables from the \`api.var\` object when they match values or URLs in the task description, info, or target page. Do NOT hardcode these values. For example, if a variable \`BASE_URL\` is \`http://localhost:6001\`, write \`await api.page.goto(api.var.BASE_URL)\` instead of \`await api.page.goto('http://localhost:6001')\`.
   Available project variables (reference them as \`api.var.KEY_NAME\`):
   ${JSON.stringify(variables, null, 2)}`
          : ""
      }`;

      const feedbackBlocks: Attachment[] = [
        { type: "text", text: feedbackPrompt },
      ];

      if (testResult.context) {
        if (testResult.context.pageContent) {
          feedbackBlocks.push({
            type: "text",
            text: `--- CURRENT DOM STATE AT FAILURE ---\n${testResult.context.pageContent}`,
          });
        }
        if (testResult.context.screenshot) {
          let base64Data = "";
          try {
            base64Data = fs
              .readFileSync(testResult.context.screenshot)
              .toString("base64");
          } catch (e) {
            console.warn(
              `[Compiler Warning] Failed to read self-healing screenshot from disk:`,
              e,
            );
          }
          if (base64Data) {
            feedbackBlocks.push({
              type: "image",
              data: base64Data,
              mimeType: "image/png",
            });
          }
        }
      }

      const feedbackStart = performance.now();
      let responseText = "";
      for await (const chunk of session.prompt([
        { role: "user", content: feedbackBlocks },
      ])) {
        if (chunk.type === "text" && chunk.text) {
          responseText += chunk.text;
        }
      }
      currentCode = cleanCode(responseText);
      if (tracker) {
        tracker.recordTaskTiming(
          nodeId,
          "agent",
          performance.now() - feedbackStart,
        );
      }
    }
  }

  if (tracker) {
    tracker.endTaskTimer(nodeId, taskStart);
  }

  return finalBody;
}
