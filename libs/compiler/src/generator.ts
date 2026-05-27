import * as fs from "fs";
import * as path from "path";
import vm from "node:vm";
import { type Browser, type Page, chromium } from "playwright";
import type { Task, Path } from "@libs/domain";
import { loadProject } from "@libs/loader";
import { execute, expect } from "@libs/executor";
import type { GroundingContext } from "@libs/executor";
import type { Session, Attachment } from "@libs/agents";
import type { CompilerPerformanceTracker } from "./tracker";

// Stateful grounding session to preserve browser state across actions
export class CompilerGroundingSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private headless: boolean = true;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  async getPage(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: this.headless });
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }
    return this.page!;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
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
function compileCodeToFunction(codeStr: string, tasksObj: any): (api: any) => Promise<void> {
  let cleanCode = codeStr
    .replace(/\(api:\s*TestAPI\)/g, "(api)")
    .trim();

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
  compiledActionsCache: Map<string, { code: string; title: string }>,
  upToActionId: string,
  existingPage?: Page,
): Promise<{ error: any; context: GroundingContext | null }> {
  let executionError: any = null;
  let groundingContext: GroundingContext | null = null;

  try {
    // Load project configuration variables
    let variables = {};
    try {
      const project = await loadProject(targetFilePath);
      variables = project.variables || {};
    } catch (e) {
      // Ignore
    }

    // Build tasks mapping for sandbox context
    const sandboxTasks: Record<string, (api: any) => Promise<void>> = {};
    const allNodeIds = [...prefixNodeIds, nodeId];

    // Compile prefix nodes in order
    prefixNodeIds.forEach((pid) => {
      const cached = compiledActionsCache.get(pid);
      if (cached) {
        sandboxTasks[pid] = compileCodeToFunction(cached.code, sandboxTasks);
      }
    });

    // Compile the current target node code
    const currentCodeWrapped = `async (api: TestAPI) => {\n${currentCodeBody}\n}`;
    sandboxTasks[nodeId] = compileCodeToFunction(currentCodeWrapped, sandboxTasks);

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
      upToActionId,
      headless: true,
      variables,
      existingPage,
    });

    for await (const event of runner.events()) {
      if (event.type === "task-failed" && event.taskId === upToActionId) {
        executionError = event.error;
      }
    }

    const state = runner.getState();
    const errors = state.errors.filter((e) => e.taskId === upToActionId);
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
          
          const screenshotsDir = path.resolve(process.cwd(), ".provar/screenshots");
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

export async function groundAndGenerateAction(
  targetFilePath: string,
  nodeId: string,
  node: Task,
  options: {
    prefixActions?: string[];
    compiledActionsCache?: Map<string, { code: string; title: string }>;
    session: Session;
    groundingSession?: CompilerGroundingSession;
    tracker?: CompilerPerformanceTracker;
  },
): Promise<string> {
  const prefixNodeIds = options.prefixActions || [];
  const cache = options.compiledActionsCache || new Map();
  const session = options.session;
  const groundingSession = options.groundingSession;
  const tracker = options.tracker;

  if (tracker) {
    tracker.initTask(nodeId, node.title, groundingSession ? "STATEFUL" : "SANDBOX");
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
          console.log(`[Stateful Session] Initializing page with prefix tasks...`);
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
            page
          );
          if (tracker) {
            tracker.recordTaskTiming(nodeId, "sandbox", performance.now() - sandboxStart);
          }
          context = sandboxResult.context;
        }
      } else {
        // Page is already navigated! Just capture dynamic context directly (0 sandbox runs)
        console.log(`[Stateful Session] Reusing active page state for ${nodeId} (0 sandbox runs)`);
        const pageContent = await page.content();
        let screenshot: string | undefined;
        try {
          const buf = await page.screenshot({ type: "png" });
          
          const screenshotsDir = path.resolve(process.cwd(), ".provar/screenshots");
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
      lastPrefixId
    );
    if (tracker) {
      tracker.recordTaskTiming(nodeId, "sandbox", performance.now() - sandboxStart);
    }
    context = sandboxResult.context;
  }

  // Generate compiled code body
  let generatedBody = "";
  const agentStart = performance.now();
  const blocks: Attachment[] = [
    {
      type: "text",
      text: `Generate Playwright code inside task: \nTitle: ${node.title}\nDescription: ${node.info || "None"}\nID: ${nodeId}\n\nONLY output the raw JavaScript/TypeScript code inside the task block. Do not include markdown code fences or backticks. Just the code lines. Use api.expect for assertions instead of the global expect or importing it. For example, await api.expect(api.page.locator('body')).toContainText("Expected Text");`,
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
      console.warn(`[Compiler Warning] Failed to read screenshot from disk:`, e);
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
  for await (const chunk of session.prompt(blocks)) {
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
        `[Self-Healing Loop] Action ${nodeId}: testing candidate try ${tryCount}...`,
      );

      // Fast-path: If stateful session is active, try executing directly on the active page!
      if (groundingSession) {
        let statefulMutated = false;
        const originals = new Map<string, any>();
        let page: Page | null = null;
        
        try {
          page = await groundingSession.getPage();
          const mutatingMethods = [
            "click", "fill", "type", "press", "goto", 
            "check", "uncheck", "selectOption", "hover", "dblclick"
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
              sandboxTasks[pid] = compileCodeToFunction(cached.code, sandboxTasks);
            }
          });

          const currentCodeWrapped = `async (api: TestAPI) => {\n${currentCode}\n}`;
          const currentExecFn = compileCodeToFunction(currentCodeWrapped, sandboxTasks);

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
            tracker.recordTaskTiming(nodeId, "sandbox", performance.now() - runStart);
          }

          success = true;
          finalBody = currentCode;
          console.log(
            `⚡ [Stateful Fast-Path] Action ${nodeId} executed successfully directly on active page!`,
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
            console.log(`  [Stateful Session] Actions were dispatched/performed on the page. Discarding active page state.`);
            await groundingSession.close();
            if (tracker) {
              tracker.setTaskMode(nodeId, "FALLBACK");
            }
          } else {
            console.log(`  [Stateful Session] No page actions were dispatched/performed. Reusing active page state for healing loop!`);
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
        nodeId
      );
      if (tracker) {
        tracker.recordTaskTiming(nodeId, "sandbox", performance.now() - sandboxStart);
      }

      if (!testResult.error) {
        success = true;
        finalBody = currentCode;
        console.log(
          `[Self-Healing Loop] Action ${nodeId} successfully compiled and executed on try ${tryCount}!`,
        );
        break;
      } else {
        console.error(
          `  ⚠️ [Self-Healing Loop] Try ${tryCount} failed for Action ${nodeId}: ${testResult.error?.message || testResult.error}`,
        );
        if (tryCount >= maxTries) {
          console.warn(
            `  ⚠️ [Self-Healing Loop] Max retries reached for Action ${nodeId}. Using last generated code.`,
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

        const feedbackPrompt = `The generated Playwright code failed execution during grounding checks.\nHere is the code you generated:\n\`\`\`typescript\n${currentCode}\n\`\`\`\n\nIt threw the following error:\n${testResult.error?.message || testResult.error}\n\nPlease analyze the error and the new DOM state/screenshot below. Output a corrected, more robust version of the Playwright code block. Ensure you address the selector failure or assertion failure correctly. Remember to use api.expect for assertions instead of the global expect or importing it. ONLY output the raw code block.`;

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
              base64Data = fs.readFileSync(testResult.context.screenshot).toString("base64");
            } catch (e) {
              console.warn(`[Compiler Warning] Failed to read self-healing screenshot from disk:`, e);
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
        for await (const chunk of session.prompt(feedbackBlocks)) {
          if (chunk.type === "text" && chunk.text) {
            responseText += chunk.text;
          }
        }
        currentCode = cleanCode(responseText);
        if (tracker) {
          tracker.recordTaskTiming(nodeId, "agent", performance.now() - feedbackStart);
        }
      }
    }

  if (tracker) {
    tracker.endTaskTimer(nodeId, taskStart);
  }

  return finalBody;
}
