import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import type { GraphNode, TestGraph } from "@libs/domain";
import { parseTestGraph, loadWorkspace } from "@libs/parser";
import { getAgentProvider } from "@libs/agents";
import type { Session, Attachment } from "@libs/agents";
import type { GroundingContext, TestAPI } from "@libs/executor";

import { resolvePaths } from "./resolver";
import { defaultGenerator, groundAndGenerateAction } from "./generator";

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
