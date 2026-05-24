import * as fs from "fs";
import * as path from "path";
import { runTest } from "@libs/executor";
import type { GroundingContext } from "@libs/executor";
import type { GraphNode } from "@libs/domain";
import { loadWorkspace } from "@libs/parser";
import type { Session, Attachment } from "@libs/agents";

export function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith("\`\`\`")) {
    cleaned = cleaned.replace(/^\`\`\`[a-zA-Z]*\n/, "");
    cleaned = cleaned.replace(/\n\`\`\`$/, "");
  }
  return cleaned.trim();
}

// Rules-based selector translator for visual graph grounding (used as mock generation fallback)
export function translateNodeToCode(nodeId: string, node: GraphNode): string {
  const info = (node.info || "").toLowerCase();
  const title = (node.title || "").toLowerCase();
  let codeLines: string[] = [];

  // Open App/Go to BASE_URL
  if (
    info.includes("navigate to") ||
    info.includes("open app") ||
    title.includes("open app") ||
    title.includes("navigate")
  ) {
    codeLines.push(`await api.page.goto(api.var.BASE_URL);`);
  }
  // Login flow
  else if (title.includes("login") || info.includes("login")) {
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
  }
  // Search flow
  else if (title.includes("search") || info.includes("search")) {
    const query = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "search-term"];
    codeLines.push(
      `await api.page.fill('input[type="search"]', "${query[1]}");`,
    );
    codeLines.push(`await api.page.press('input[type="search"]', 'Enter');`);
  }
  // Add item flow
  else if (title.includes("add") || title.includes("create")) {
    const itemName = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "New Item"];
    codeLines.push(`await api.page.click('button:has-text("Add")');`);
    codeLines.push(
      `await api.page.fill('input[name="title"]', "${itemName[1]}");`,
    );
    codeLines.push(`await api.page.click('button:has-text("Save")');`);
  }
  // Click action (generic)
  else if (title.includes("click") || info.includes("click")) {
    const target = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "button"];
    codeLines.push(`await api.page.click('text="${target[1]}"');`);
  }
  // Assertions
  else if (
    title.includes("assert") ||
    info.includes("assert") ||
    title.includes("verify") ||
    info.includes("verify")
  ) {
    const target = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "expected text"];
    codeLines.push(
      `await expect(api.page.locator('body')).toContainText("${target[1]}");`,
    );
  }
  // Default generic action
  else {
    codeLines.push(`// AI generated logic for: ${title}`);
    codeLines.push(`// Fallback implementation`);
    codeLines.push(`await api.page.waitForTimeout(500);`);
  }

  return codeLines.map((line) => `    ${line}`).join("\n");
}

export async function defaultGenerator(
  nodeId: string,
  node: GraphNode,
  context: GroundingContext | null,
): Promise<string> {
  // If the agent API is not available, we use the rule-based fallback
  // (In the real compiler, this is an LLM prompt call)

  if (context) {
    // A real implementation would parse context.pageContent
    // and context.screenshot to generate accurate selectors.
  }

  return translateNodeToCode(nodeId, node);
}

// Single-action execution-grounded generation logic
export async function groundAndGenerateAction(
  targetFilePath: string,
  nodeId: string,
  node: GraphNode,
  options?: {
    generator?: (
      nodeId: string,
      node: GraphNode,
      context: GroundingContext | null,
    ) => Promise<string>;
    prefixActions?: string[];
    compiledActionsCache?: Map<
      string,
      { code: string; visualCompare?: boolean; title: string }
    >;
    session?: Session;
  },
): Promise<string> {
  const generator = options?.generator || defaultGenerator;
  const prefixNodeIds = options?.prefixActions || [];
  const cache = options?.compiledActionsCache || new Map();
  const session = options?.session;

  let context: GroundingContext | null = null;
  let prefixCode = "";

  for (const pid of prefixNodeIds) {
    const cached = cache.get(pid);
    if (cached) {
      prefixCode += cached.code + "\n\n";
    }
  }

  if (prefixNodeIds.length > 0) {
    const lastPrefixId = prefixNodeIds[prefixNodeIds.length - 1];

    // Stub implementation for the current action to compile properly in dynamic import
    const currentActionStub = `const action_${nodeId} = action({\n  id: ${JSON.stringify(nodeId)},\n  title: ${JSON.stringify(node.title)},\n  execute: async (api) => {}\n});\n`;

    const pathActionList = [
      ...prefixNodeIds.map((pid) => `action_${pid}`),
      `action_${nodeId}`,
    ].join(", ");

    const tempSpecString =
      `import { test, action, expect, TestAPI } from "@libs/executor";\n\n` +
      `export const metadata = { name: "grounding", info: "" };\n\n` +
      prefixCode +
      currentActionStub +
      `export const tests = [\n  test([${pathActionList}]),\n];\n`;

    // FIXME: This is a hacky way to generate the spec path
    const tempSpecPath = path.join(
      path.dirname(targetFilePath),
      `__grounding_${nodeId}.test.ts`,
    );

    try {
      fs.writeFileSync(tempSpecPath, tempSpecString, "utf-8");

      let variables = {};
      try {
        const ws = await loadWorkspace(targetFilePath);
        variables = ws.config.variables || {};
      } catch (err) {
        // Ignore
      }

      const runner = runTest({
        testFilePath: tempSpecPath,
        upToActionId: lastPrefixId,
        headless: true,
        variables,
      });

      for await (const event of runner.events()) {
        if (event.type === "action-failed") {
          console.error(
            `  ⚠️ [Grounding Execution Warning] Action ${event.actionId} failed: ${event.error?.message || event.error}`,
          );
        }
      }

      context = runner.getGroundingContext();
    } finally {
      try {
        if (fs.existsSync(tempSpecPath)) {
          fs.unlinkSync(tempSpecPath);
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }

  // Generate the action code based on the execution context
  let generatedBody = "";
  if (session) {
    const blocks: Attachment[] = [
      {
        type: "text",
        text: `Generate Playwright code for action:\nTitle: ${node.title}\nInfo: ${node.info || "None"}\nID: ${nodeId}`,
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

      const currentActionStub = `const action_${nodeId} = action({\n  id: ${JSON.stringify(nodeId)},\n  title: ${JSON.stringify(node.title)},\n  execute: async (api) => {\n${currentCode}\n  }\n});\n`;

      const pathActionList = [
        ...prefixNodeIds.map((pid) => `action_${pid}`),
        `action_${nodeId}`,
      ].join(", ");

      const tempSpecString =
        `import { test, action, expect, TestAPI } from "@libs/executor";\n\n` +
        `export const metadata = { name: "grounding", info: "" };\n\n` +
        prefixCode +
        currentActionStub +
        `export const tests = [\n  test([${pathActionList}]),\n];\n`;

      const tempSpecPath = path.join(
        path.dirname(targetFilePath),
        `__grounding_${nodeId}.test.ts`,
      );

      let runError: any = null;
      let failureContext: GroundingContext | null = null;

      try {
        fs.writeFileSync(tempSpecPath, tempSpecString, "utf-8");

        let variables = {};
        try {
          const ws = await loadWorkspace(targetFilePath);
          variables = ws.config.variables || {};
        } catch (err) {
          // Ignore
        }

        const runner = runTest({
          testFilePath: tempSpecPath,
          upToActionId: nodeId,
          headless: true,
          variables,
        });

        for await (const event of runner.events()) {
          if (event.type === "action-failed" && event.actionId === nodeId) {
            runError = event.error;
          }
        }

        failureContext = runner.getGroundingContext();
      } finally {
        try {
          if (fs.existsSync(tempSpecPath)) {
            fs.unlinkSync(tempSpecPath);
          }
        } catch (err) {
          // Ignore cleanup
        }
      }

      if (!runError) {
        success = true;
        finalBody = currentCode;
        console.log(
          `[Error Healing Loop] Action ${nodeId} successfully compiled and executed on try ${tryCount}!`,
        );
        break;
      } else {
        console.error(
          `  ⚠️ [Error Healing Loop] Try ${tryCount} failed for Action ${nodeId}: ${runError?.message || runError}`,
        );
        if (tryCount >= maxTries) {
          console.warn(
            `  ⚠️ [Error Healing Loop] Max retries reached for Action ${nodeId}. Using last generated code.`,
          );
          finalBody = currentCode;
          break;
        }

        const feedbackPrompt = `The generated Playwright code failed during grounding compilation.\nHere is the code you generated:\n\`\`\`typescript\n${currentCode}\n\`\`\`\n\nIt threw the following execution error:\n${runError?.message || runError}\n\nPlease analyze the error and the new DOM state/screenshot below. Output a corrected, more robust version of the Playwright code block.\nEnsure you address the selector failure or assertion failure correctly. ONLY output the raw code block.`;

        const feedbackBlocks: Attachment[] = [
          { type: "text", text: feedbackPrompt },
        ];

        if (failureContext) {
          if (failureContext.pageContent) {
            feedbackBlocks.push({
              type: "text",
              text: `--- CURRENT DOM STATE AT FAILURE ---\n${failureContext.pageContent}`,
            });
          }
          if (failureContext.screenshot) {
            feedbackBlocks.push({
              type: "image",
              data: failureContext.screenshot,
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
