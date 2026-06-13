import * as fs from "fs";
import type { Page } from "playwright";
import type { Task } from "@libs/domain";
import { loadProject } from "../loader";
import { expect } from "@playwright/test";
import type { Session, Attachment, Message } from "@libs/models";
import type { CompilerPerformanceTracker } from "./tracker";
import type { TestAPI, GroundingContext } from "../types";
import {
  CompilerGroundingSession,
  compileCodeToFunction,
  runGroundingSandbox,
} from "./sandbox";
import { saveScreenshotToTmp } from "../screenshot";
import {
  SelfHealingLoop,
  type LLMAdapter,
  type LLMMessage,
  type SandboxResult,
} from "@thani-sh/duct-tape";

export { CompilerGroundingSession };

/**
 * cleanCode strips markdown code blocks or backticks from generated code snippets.
 */
export function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "");
    cleaned = cleaned.replace(/\n```$/, "");
  }
  return cleaned.trim();
}

/**
 * groundAndGenerateTask runs the grounding sandbox environment and delegates code generation to the AI agent.
 */
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
  let variables: Record<string, unknown> = {};
  let project: any = null;
  try {
    project = await loadProject(targetFilePath);
    variables = (project.variables as unknown as Record<string, unknown>) || {};
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
          screenshot = saveScreenshotToTmp(buf, `compile-${nodeId}`);
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

  let processedCount = 0;
  const llm: LLMAdapter = {
    prompt: async function* (messages: LLMMessage[]) {
      let newLLMMessages = messages.slice(processedCount);
      processedCount = messages.length + 1;

      const sessionMessages: Message[] = newLLMMessages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content as any,
      }));

      for await (const chunk of session.prompt(sessionMessages)) {
        if (chunk.type === "text" && chunk.text) {
          yield chunk.text;
        }
      }
    },
  };

  const executor = async (
    currentCode: string,
  ): Promise<SandboxResult<GroundingContext>> => {
    // 1. Fast-path: If stateful session is active, try executing directly on the active page!
    if (groundingSession) {
      let statefulMutated = false;
      const originals = new Map<
        string,
        (...args: unknown[]) => Promise<unknown>
      >();
      let page: Page | null = null;
      let pageRecord: Record<string, (...args: unknown[]) => Promise<unknown>> =
        {};

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
        ] as const;

        pageRecord = page as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >;
        mutatingMethods.forEach((method) => {
          const original = pageRecord[method];
          if (typeof original === "function") {
            const boundOriginal = original.bind(page);
            originals.set(method, original);
            pageRecord[method] = async (...args: unknown[]) => {
              const res = await boundOriginal(...args);
              statefulMutated = true;
              return res;
            };
          }
        });

        const sandboxTasks: Record<string, (api: TestAPI) => Promise<void>> =
          {};
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

        const api: TestAPI = {
          page,
          var: variables,
          state: {},
          expect,
        };

        const runStart = performance.now();
        try {
          await currentExecFn(api);
        } finally {
          // Restore original page methods
          originals.forEach((orig, method) => {
            pageRecord[method] = orig;
          });
        }

        if (tracker) {
          tracker.recordTaskTiming(
            nodeId,
            "sandbox",
            performance.now() - runStart,
          );
        }

        const pageContent = await page.content();
        let screenshot: string | undefined;
        try {
          const buf = await page.screenshot({ type: "png" });
          screenshot = saveScreenshotToTmp(buf, `compile-${nodeId}`);
        } catch (e) {}

        console.log(
          `⚡ [Stateful Fast-Path] Task ${nodeId} executed successfully directly on active page!`,
        );
        return {
          success: true,
          context: { pageContent, screenshot },
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (page) {
          originals.forEach((orig, method) => {
            pageRecord[method] = orig;
          });
        }

        console.log(
          `⚠️ [Stateful Fast-Path Fail] Direct execution failed for ${nodeId}: ${errMsg}`,
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

    // 2. Safe-path: Full sandbox execution verify
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
      return {
        success: true,
        context: testResult.context ?? undefined,
      };
    }

    return {
      success: false,
      error:
        testResult.error instanceof Error
          ? testResult.error
          : new Error(String(testResult.error)),
      context: testResult.context ?? undefined,
    };
  };

  const loop = new SelfHealingLoop<GroundingContext>(llm, executor, {
    maxRetries: 3,
    systemPrompt:
      "You are a code generation agent. Output ONLY the raw executable code without markdown fences or backticks. No explanation.",
    buildHealerPrompt: ({ code, error, context }) => {
      const basePrompt = `The generated Playwright code failed execution during grounding checks.
Here is the code you generated:
\`\`\`typescript
${code}
\`\`\`

It threw the following error:
${error}

Please analyze the error and the new DOM state/screenshot below. Output a corrected, more robust version of the Playwright code block.

STRICTLY follow these constraints in your correction:
1. Address the selector or assertion failure correctly.
2. Do NOT use conditional branches (if/else, switch), loops, or try-catch blocks to hide errors. Let errors throw naturally if they fail.
3. Locate elements using this priority order: [data-testid="..."] -> #id -> .class -> text/ARIA role -> other matchers.
4. Use api.expect for assertions.
5. ONLY output the raw code block (no markdown blocks or fences).${
        Object.keys(variables).length > 0
          ? `\n6. Use project variables from the \`api.var\` object when they match values or URLs in the task description, info, or target page. Do NOT hardcode these values.
   Available project variables (reference them as \`api.var.KEY_NAME\`):
   ${JSON.stringify(variables, null, 2)}`
          : ""
      }`;

      const feedbackBlocks: Attachment[] = [{ type: "text", text: basePrompt }];

      if (context) {
        if (context.pageContent) {
          feedbackBlocks.push({
            type: "text",
            text: `--- CURRENT DOM STATE AT FAILURE ---\n${context.pageContent}`,
          });
        }
        if (context.screenshot) {
          let base64Data = "";
          try {
            base64Data = fs.readFileSync(context.screenshot).toString("base64");
          } catch (e) {}
          if (base64Data) {
            feedbackBlocks.push({
              type: "image",
              data: base64Data,
              mimeType: "image/png",
            });
          }
        }
      }

      return feedbackBlocks as any;
    },
    onRetry: ({ retryCount, error }) => {
      if (tracker) {
        tracker.recordTaskRetry(nodeId);
        tracker.setTaskStatus(nodeId, "HEALED");
      }
      console.warn(
        `  ⚠️ [Self-Healing Loop] Try ${retryCount} failed for Task ${nodeId}: ${error}`,
      );
    },
    onSuccess: ({ retryCount }) => {
      console.log(
        `[Self-Healing Loop] Task ${nodeId} successfully compiled and executed on try ${retryCount + 1}!`,
      );
    },
    onFailure: ({ error }) => {
      console.error(
        `  ⚠️ [Self-Healing Loop] Max retries reached for Task ${nodeId}. Using last generated code.`,
      );
      if (tracker) {
        tracker.setTaskStatus(nodeId, "FAILED");
      }
    },
  });

  const agentTime = performance.now() - agentStart;
  const loopResult = await loop.run(blocks as any);

  if (tracker) {
    tracker.recordTaskTiming(nodeId, "agent", agentTime);
    tracker.endTaskTimer(nodeId, taskStart);
  }

  return loopResult.finalCode;
}
