import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
import { runTest, TestAPI, GroundingContext } from "@libs/executor";
import crypto from "crypto";

export interface GraphNode {
  title: string;
  info: string;
  next?: string | string[];
  visualCompare?: boolean;
  asserts?: Record<string, { title: string; info: string }>;
  graph?: {
    info: string;
    start: string;
    nodes: Record<string, GraphNode>;
  };
}

export interface TestGraph {
  name: string;
  graph: {
    info: string;
    start: string;
    nodes: Record<string, GraphNode>;
  };
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

// Find variables from .provar/config.yml by locating the .provar directory in the path
function findAndLoadVariables(testFilePath: string): Record<string, any> {
  const provarIndex = testFilePath.lastIndexOf(".provar");
  if (provarIndex === -1) {
    return {};
  }

  const configPath = path.join(
    testFilePath.slice(0, provarIndex + 7),
    "config.yml",
  );
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const doc = yaml.load(content) as any;
      const rawVariables = doc?.variables || {};

      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(rawVariables)) {
        if (typeof val === "string") {
          const envMatch = val.match(/^\$\{ENV\.(.+)\}$/);
          if (envMatch && envMatch[1]) {
            resolved[key] = process.env[envMatch[1]] || "";
          } else {
            resolved[key] = val;
          }
        } else {
          resolved[key] = val;
        }
      }
      return resolved;
    } catch (err) {
      // Silent ignore
    }
  }
  return {};
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
  },
): Promise<string> {
  const generator = options?.generator || defaultGenerator;
  const prefixNodeIds = options?.prefixActions || [];
  const cache = options?.compiledActionsCache || new Map();

  let context: GroundingContext | null = null;

  if (prefixNodeIds.length > 0) {
    let prefixCode = "";
    for (const pid of prefixNodeIds) {
      const cached = cache.get(pid);
      if (cached) {
        prefixCode += cached.code + "\n\n";
      }
    }

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

      const variables = findAndLoadVariables(targetFilePath);

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

  const generatedBody = await generator(nodeId, node, context);
  return generatedBody;
}

// Main compiler orchestrator
export async function compile(
  options: CompilerOptions,
): Promise<CompileResult> {
  const content = fs.readFileSync(options.yamlPath, "utf-8");
  const graphDef = yaml.load(content) as TestGraph;

  const resolvedPathsList = resolvePaths(graphDef);
  const outputPath =
    options.outputPath || options.yamlPath.replace(".test.yml", ".test.ts");

  const generator = options.generator || defaultGenerator;
  const generatedActions = new Map<
    string,
    { code: string; visualCompare?: boolean; title: string }
  >();

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
}
