import * as fs from "fs";
import * as path from "path";
import { runTest } from "@libs/executor";
import type { TestAPI, GroundingContext } from "@libs/executor";
import crypto from "crypto";
import type { GraphNode, TestGraph } from "@libs/domain";
import { parseTestGraph, loadWorkspace } from "@libs/parser";
import { getAgentProvider } from "@libs/agents";
import type { Session, Attachment } from "@libs/agents";

function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "");
    cleaned = cleaned.replace(/\n```$/, "");
  }
  return cleaned.trim();
}

export interface CompilerOptions {
  yamlPath: string;
  outputPath?: string;
  generator?: (
    nodeId: string,
    node: GraphNode,
    context: GroundingContext | null,
  ) => Promise<string>;
}

export interface CompileResult {
  success: boolean;
  outputPath: string;
  generatedCode: string;
  pathsResolved: number;
}

// Function to resolve all unique linear paths from start to terminal nodes in a directed graph
export function resolvePaths(graphDef: TestGraph): string[][] {
  const paths: string[][] = [];
  const start = graphDef.graph.start;
  const nodes = graphDef.graph.nodes;

  if (!start || !nodes || !nodes[start]) {
    return [];
  }

  function traverse(
    currentNodeId: string,
    currentPath: string[],
    visited: Set<string>,
  ) {
    if (visited.has(currentNodeId)) {
      // Loop detected, truncate path to avoid infinite loops
      paths.push([...currentPath]);
      return;
    }

    const node = nodes[currentNodeId];
    if (!node) {
      paths.push([...currentPath]);
      return;
    }

    const nextPath = [...currentPath, currentNodeId];
    const newVisited = new Set(visited).add(currentNodeId);

    if (!node.next || (Array.isArray(node.next) && node.next.length === 0)) {
      paths.push(nextPath);
      return;
    }

    const nextNodes = Array.isArray(node.next) ? node.next : [node.next];
    for (const nextNode of nextNodes) {
      traverse(nextNode, nextPath, newVisited);
    }
  }

  traverse(start, [], new Set());
  return paths;
}

// Rules-based selector translator for visual graph grounding (used as mock generation fallback)
function translateNodeToCode(nodeId: string, node: GraphNode): string {
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
    codeLines.push(
      `await api.page.fill('input[placeholder="Username"]', ${JSON.stringify(username[1])});`,
    );
    codeLines.push(
      `await api.page.click('button:has-text("Login / Register")');`,
    );
  }
  // Add task flow (high priority check to avoid list creation false matches)
  else if (
    title.includes("add task") ||
    info.includes("add task") ||
    title.includes("add personal task") ||
    title.includes("add work task")
  ) {
    const taskName = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "Buy Milk"];
    codeLines.push(
      `await api.page.fill('input[placeholder="What needs to be done?"]', ${JSON.stringify(taskName[1])});`,
    );
    codeLines.push(`await api.page.click('button:has-text("Add Task")');`);
  }
  // Create list flow
  else if (title.includes("create list") || info.includes("create list")) {
    const listName = info.match(/"([^"]+)"/) ||
      title.match(/"([^"]+)"/) || ["", "Shopping"];
    codeLines.push(
      `await api.page.fill('input[placeholder="New List..."]', ${JSON.stringify(listName[1])});`,
    );
    codeLines.push(`await api.page.click('button:has-text("Add List")');`);
  }
  // Create personal list
  else if (title.includes("personal list") || info.includes("personal list")) {
    codeLines.push(
      `await api.page.fill('input[placeholder="New List..."]', "Personal");`,
    );
    codeLines.push(`await api.page.click('button:has-text("Add List")');`);
  }
  // Create work list
  else if (title.includes("work list") || info.includes("work list")) {
    codeLines.push(
      `await api.page.fill('input[placeholder="New List..."]', "Work");`,
    );
    codeLines.push(`await api.page.click('button:has-text("Add List")');`);
  }
  // Complete task flow
  else if (
    title.includes("complete task") ||
    info.includes("complete task") ||
    title.includes("checkbox")
  ) {
    codeLines.push(`await api.page.click('input[type="checkbox"]');`);
  }
  // Fallback placeholder
  else {
    codeLines.push(`// Fallback log for: ${node.title} - ${node.info}`);
    codeLines.push(`console.log("Executing node: ${nodeId}");`);
  }

  // Handle assertions
  if (node.asserts) {
    for (const [assertId, assert] of Object.entries(node.asserts)) {
      const assertInfo = (assert.info || "").toLowerCase();
      const assertTitle = (assert.title || "").toLowerCase();

      if (
        assertInfo.includes("completed") ||
        assertTitle.includes("completed") ||
        assertInfo.includes("class")
      ) {
        codeLines.push(
          `const label = api.page.locator('span:has-text("Buy Milk")');`,
        );
        codeLines.push(`await expect(label).toHaveClass(/completed/);`);
      } else {
        codeLines.push(`// Assert: ${assert.title} - ${assert.info}`);
      }
    }
  }

  return codeLines.map((line) => `    ${line}`).join("\n");
}

// Pluggable generator fallback with rich grounding logging
export async function defaultGenerator(
  nodeId: string,
  node: GraphNode,
  context: GroundingContext | null,
): Promise<string> {
  if (context) {
    console.log(`[Compiler Grounding] Context available for node: ${nodeId}`);
    console.log(
      `  - DOM length: ${context.pageContent?.length || 0} characters`,
    );
    console.log(
      `  - Screenshot state: ${context.screenshot ? "Base64 png captured" : "Not captured"}`,
    );
  } else {
    console.log(
      `[Compiler Grounding] Initial context for start node: ${nodeId}`,
    );
  }

  return translateNodeToCode(nodeId, node);
}

// Single-action execution-grounded generation logic
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

  // Generate initial code body
  let generatedBody = "";
  if (session) {
    console.log(
      `[Compiler] Generating code with AI session for Action: ${nodeId} (${node.title})`,
    );
    const promptText = `Generate Playwright execute block code for node: "${nodeId}"
Title: "${node.title}"
Info: "${node.info}"
Assertions: ${JSON.stringify(node.asserts || {})}

Analyze the provided DOM state and/or screenshot below (if available) to locate the correct, stable elements.
Do not use fragile selectors. Prefer text/placeholder/stable CSS selectors.
Only output raw TypeScript/JavaScript code lines that should go inside the execute function body. Do not include markdown code fences or backticks.`;

    const promptBlocks: Attachment[] = [{ type: "text", text: promptText }];

    if (context) {
      if (context.pageContent) {
        promptBlocks.push({
          type: "text",
          text: `--- CURRENT DOM STATE ---\n${context.pageContent}`,
        });
      }
      if (context.screenshot) {
        promptBlocks.push({
          type: "image",
          data: context.screenshot,
          mimeType: "image/png",
        });
      }
    }

    let responseText = "";
    for await (const chunk of session.prompt(promptBlocks)) {
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

        const feedbackPrompt = `The generated Playwright code failed during grounding compilation.
Here is the code you generated:
\`\`\`typescript
${currentCode}
\`\`\`

It threw the following execution error:
${runError?.message || runError}

Please analyze the error and the new DOM state/screenshot below. Output a corrected, more robust version of the Playwright code block.
Ensure you address the selector failure or assertion failure correctly. ONLY output the raw code block.`;

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

// Main compiler orchestrator
// Main compiler orchestrator
export async function compile(
  options: CompilerOptions,
): Promise<CompileResult> {
  const content = fs.readFileSync(options.yamlPath, "utf-8");
  const graphDef = parseTestGraph(content);

  const resolvedPathsList = resolvePaths(graphDef);
  const outputPath =
    options.outputPath || options.yamlPath.replace(".test.yml", ".test.ts");

  // Load workspace config to determine provider and workspace root directory
  let providerName = "gemini-cli";
  let workspaceDir = process.cwd();
  try {
    const ws = await loadWorkspace(options.yamlPath);
    if (ws.config?.provider?.name) {
      providerName = ws.config.provider.name;
    }
    workspaceDir = path.dirname(ws.provarPath);
  } catch (err) {
    // Ignore
  }

  const agentProvider = getAgentProvider(providerName, {
    systemPrompt:
      "You are the Provar AI compiler. Your task is to generate selector-accurate and robust Playwright code for a test step. Generate ONLY the raw JavaScript/TypeScript code inside the execute block of the action. Do not include markdown code fences or backticks. Just the code lines.",
    workspaceDir,
  });

  let session: Session | undefined;
  if (agentProvider) {
    console.log(`[Compiler] Starting agent provider: ${providerName}`);
    await agentProvider.start();
    session = await agentProvider.createSession({
      sessionPrompt: `We are compiling the test graph: ${graphDef.name}.`,
    });
  }

  const generator = options.generator || defaultGenerator;
  const generatedActions = new Map<
    string,
    { code: string; visualCompare?: boolean; title: string }
  >();

  try {
    // Sequential recursive node compilation in correct path prefix context
    async function compileNodeRecursively(
      nodeId: string,
      node: GraphNode,
      prefixActions: string[],
    ) {
      if (generatedActions.has(nodeId)) {
        return;
      }

      if (node.graph) {
        const innerNodes = node.graph.nodes;
        const innerPaths = resolvePaths({ name: nodeId, graph: node.graph });
        const primaryPath = innerPaths[0] || [];

        let subPrefix = [...prefixActions];
        for (const subId of primaryPath) {
          const subNode = innerNodes[subId];
          if (subNode) {
            await compileNodeRecursively(subId, subNode, subPrefix);
            subPrefix.push(subId);
          }
        }

        let executeBlock = `async (api: TestAPI) => {\n`;
        executeBlock += `    // Sub-graph context: ${node.title}\n`;
        for (const subId of primaryPath) {
          executeBlock += `    await action_${subId}(api);\n`;
        }
        executeBlock += `  }`;

        const visualCompareLine =
          node.visualCompare !== undefined
            ? `\n  visualCompare: ${node.visualCompare},`
            : "";

        const actionCode =
          `const action_${nodeId} = action({\n` +
          `  id: ${JSON.stringify(nodeId)},\n` +
          `  title: ${JSON.stringify(node.title)},${visualCompareLine}\n` +
          `  execute: ${executeBlock}\n` +
          `});`;

        generatedActions.set(nodeId, {
          code: actionCode,
          visualCompare: node.visualCompare,
          title: node.title,
        });
      } else {
        const actionBody = await groundAndGenerateAction(
          options.yamlPath,
          nodeId,
          node,
          {
            generator,
            prefixActions,
            compiledActionsCache: generatedActions,
            session,
          },
        );

        const visualCompareLine =
          node.visualCompare !== undefined
            ? `\n  visualCompare: ${node.visualCompare},`
            : "";

        const actionCode =
          `const action_${nodeId} = action({\n` +
          `  id: ${JSON.stringify(nodeId)},\n` +
          `  title: ${JSON.stringify(node.title)},${visualCompareLine}\n` +
          `  execute: async (api: TestAPI) => {\n` +
          `${actionBody}\n` +
          `  }\n` +
          `});`;

        generatedActions.set(nodeId, {
          code: actionCode,
          visualCompare: node.visualCompare,
          title: node.title,
        });
      }
    }

    // Iterate over paths and recursively compile action nodes chronologically
    for (const pathNodeIds of resolvedPathsList) {
      const prefix: string[] = [];
      for (const nid of pathNodeIds) {
        const node = graphDef.graph.nodes[nid];
        if (node) {
          await compileNodeRecursively(nid, node, prefix);
          prefix.push(nid);
        }
      }
    }

    let codeBody = "";
    for (const [id, cached] of generatedActions.entries()) {
      codeBody += cached.code + "\n\n";
    }

    let testsArray = `export const tests = [\n`;
    resolvedPathsList.forEach((pathNodeIds) => {
      const actionArray = pathNodeIds.map((nid) => `action_${nid}`).join(", ");
      testsArray += `  test([${actionArray}]),\n`;
    });
    testsArray += `];\n`;

    const bodyContent =
      `import { test, action, expect, TestAPI } from "@libs/executor";\n\n` +
      `export const metadata = {\n  name: ${JSON.stringify(graphDef.name)},\n  info: ${JSON.stringify(graphDef.graph.info || "")}\n};\n\n` +
      codeBody +
      testsArray;

    const hash = crypto.createHash("sha256").update(bodyContent).digest("hex");

    const fileContent =
      `// date: ${new Date().toISOString()}\n` +
      `// hash: ${hash}\n` +
      bodyContent;

    fs.writeFileSync(outputPath, fileContent, "utf-8");

    return {
      success: true,
      outputPath,
      generatedCode: fileContent,
      pathsResolved: resolvedPathsList.length,
    };
  } finally {
    if (agentProvider) {
      console.log(`[Compiler] Stopping agent provider: ${providerName}`);
      await agentProvider.stop();
    }
  }
}
