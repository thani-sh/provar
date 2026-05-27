import * as fs from "fs";
import * as path from "path";
import vm from "node:vm";
import type { Task, Path } from "@libs/domain";
import { loadProject } from "@libs/loader";
import { execute } from "@libs/executor";
import type { GroundingContext } from "@libs/executor";
import type { Session, Attachment } from "@libs/agents";

export function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "");
    cleaned = cleaned.replace(/\n```$/, "");
  }
  return cleaned.trim();
}

// Rules-based selector translator (fallback generator)
export function translateNodeToCode(nodeId: string, node: Task): string {
  const info = (node.info || "").toLowerCase();
  const title = (node.title || "").toLowerCase();
  let codeLines: string[] = [];

  if (
    info.includes("navigate to") ||
    info.includes("open app") ||
    title.includes("open app") ||
    title.includes("navigate")
  ) {
    codeLines.push(`await api.page.goto(api.var.BASE_URL);`);
  } else if (title.includes("login") || info.includes("login")) {
    const username = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "testuser"];
    const password = "password123";
    codeLines.push(
      `await api.page.fill('input[type="text"]', "${username[1]}");`,
    );
    codeLines.push(
      `await api.page.fill('input[type="password"]', "${password}");`,
    );
    codeLines.push(`await api.page.click('button[type="submit"]');`);
  } else if (title.includes("search") || info.includes("search")) {
    const query = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "search-term"];
    codeLines.push(
      `await api.page.fill('input[type="search"]', "${query[1]}");`,
    );
    codeLines.push(`await api.page.press('input[type="search"]', 'Enter');`);
  } else if (title.includes("add") || title.includes("create")) {
    const itemName = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "New Item"];
    codeLines.push(`await api.page.click('button:has-text("Add")');`);
    codeLines.push(
      `await api.page.fill('input[name="title"]', "${itemName[1]}");`,
    );
    codeLines.push(`await api.page.click('button:has-text("Save")');`);
  } else if (title.includes("click") || info.includes("click")) {
    const target = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "button"];
    codeLines.push(`await api.page.click('text="${target[1]}"');`);
  } else if (
    title.includes("assert") ||
    info.includes("assert") ||
    title.includes("verify") ||
    info.includes("verify")
  ) {
    const target = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "expected text"];
    codeLines.push(
      `await api.expect(api.page.locator('body')).toContainText("${target[1]}");`,
    );
  } else {
    codeLines.push(`// AI generated logic for: ${title}`);
    codeLines.push(`// Fallback implementation`);
    codeLines.push(`await api.page.waitForTimeout(500);`);
  }

  return codeLines.map((line) => `    ${line}`).join("\n");
}

export async function defaultGenerator(
  nodeId: string,
  node: Task,
  context: GroundingContext | null,
): Promise<string> {
  return translateNodeToCode(nodeId, node);
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
    const page = (runner as any).activePage;
    if (page) {
      try {
        const pageContent = await page.content();
        let screenshot: string | undefined;
        try {
          const buf = await page.screenshot({ type: "png" });
          screenshot = buf.toString("base64");
        } catch (e) {}
        groundingContext = { pageContent, screenshot };
      } catch (e) {}
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
  options?: {
    generator?: (
      nodeId: string,
      node: Task,
      context: GroundingContext | null,
    ) => Promise<string>;
    prefixActions?: string[];
    compiledActionsCache?: Map<string, { code: string; title: string }>;
    session?: Session;
  },
): Promise<string> {
  const generator = options?.generator || defaultGenerator;
  const prefixNodeIds = options?.prefixActions || [];
  const cache = options?.compiledActionsCache || new Map();
  const session = options?.session;

  let context: GroundingContext | null = null;

  // Spawns sandbox up to prefix boundary to retrieve context
  if (prefixNodeIds.length > 0) {
    const lastPrefixId = prefixNodeIds[prefixNodeIds.length - 1]!;
    const sandboxResult = await runGroundingSandbox(
      targetFilePath,
      nodeId,
      node,
      prefixNodeIds,
      "// placeholder",
      cache,
      lastPrefixId,
    );
    context = sandboxResult.context;
  }

  // Generate compiled code body
  let generatedBody = "";
  if (session) {
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
      blocks.push({
        type: "image",
        data: context.screenshot,
        mimeType: "image/png",
      });
    }

    let responseText = "";
    for await (const chunk of session.prompt(blocks)) {
      if (chunk.type === "text" && chunk.text) {
        responseText += chunk.text;
      }
    }
    generatedBody = cleanCode(responseText);
  } else {
    generatedBody = await generator(nodeId, node, context);
  }

  // Self-Healing compiler loop
  let finalBody = generatedBody;
  if (session) {
    const maxTries = 3;
    let tryCount = 0;
    let success = false;
    let currentCode = generatedBody;

    while (tryCount < maxTries && !success) {
      tryCount++;

      console.log(
        `[Self-Healing Loop] Action ${nodeId}: testing candidate try ${tryCount}...`,
      );
      const testResult = await runGroundingSandbox(
        targetFilePath,
        nodeId,
        node,
        prefixNodeIds,
        currentCode,
        cache,
        nodeId,
      );

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
          finalBody = currentCode;
          break;
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
            feedbackBlocks.push({
              type: "image",
              data: testResult.context.screenshot,
              mimeType: "image/png",
            });
          }
        }

        let responseText = "";
        for await (const chunk of session.prompt(feedbackBlocks)) {
          if (chunk.type === "text" && chunk.text) {
            responseText += chunk.text;
          }
        }
        currentCode = cleanCode(responseText);
      }
    }
  }

  return finalBody;
}
