import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import type { Task, File } from "@libs/domain";
import { parseTestFile, loadProject } from "@libs/loader";
import { createClient } from "@libs/agents";
import type { Session, Attachment, Client } from "@libs/agents";
import type { GroundingContext, TestAPI } from "@libs/executor";

import { defaultGenerator, groundAndGenerateAction } from "./generator";

export interface CompilerOptions {
  yamlPath: string;
  outputPath?: string;
  generator?: (
    nodeId: string,
    node: Task,
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
  const fileDef = parseTestFile(content, options.yamlPath);

  const outputPath =
    options.outputPath ?? options.yamlPath.replace(".test.yml", ".test.ts");

  // Load project config to determine provider and workspace root directory
  let providerName: "gemini-cli" | "copilot-cli" = "gemini-cli";
  let workspaceDir = process.cwd();
  try {
    const project = await loadProject(options.yamlPath);
    workspaceDir = path.dirname(project.path);
  } catch (err) {
    // Ignore
  }

  let client: Client | undefined;
  let session: Session | undefined;
  try {
    console.log(`[Compiler] Starting agent client: ${providerName}`);
    client = createClient(providerName, { workspaceDir });
    session = await client.session();
  } catch (err) {
    console.warn(`[Compiler Warning] Failed to start LLM agent:`, err);
  }

  const generator = options.generator || defaultGenerator;
  const generatedActions = new Map<string, { code: string; title: string }>();

  try {
    // Sequential recursive node compilation in correct path prefix context
    async function compileNodeRecursively(
      nodeId: string,
      node: Task,
      prefixActions: string[],
    ) {
      if (generatedActions.has(nodeId)) {
        return;
      }

      if (node.graph) {
        const innerTasks = node.graph.tasks;
        const innerPaths = node.graph.paths;
        const primaryPath = innerPaths[0]?.tasks || [];

        let subPrefix = [...prefixActions];
        for (const subTask of primaryPath) {
          await compileNodeRecursively(subTask.id, subTask, subPrefix);
          subPrefix.push(subTask.id);
        }

        let executeBlock = `async (api: TestAPI) => {\n`;
        executeBlock += `    // Sub-graph context: ${node.title}\n`;
        for (const subTask of primaryPath) {
          executeBlock += `    await tasks[${JSON.stringify(subTask.id)}](api);\n`;
        }
        executeBlock += `  }`;

        generatedActions.set(nodeId, {
          code: executeBlock,
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

        const formattedBody = actionBody
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n");
        const executeBlock = `async (api: TestAPI) => {\n${formattedBody}\n  }`;

        generatedActions.set(nodeId, {
          code: executeBlock,
          title: node.title,
        });
      }
    }

    // Iterate over paths and recursively compile action nodes chronologically
    for (const resolvedPath of fileDef.paths) {
      const prefix: string[] = [];
      for (const task of resolvedPath.tasks) {
        await compileNodeRecursively(task.id, task, prefix);
        prefix.push(task.id);
      }
    }

    let tasksMap = `export const tasks = {\n`;
    for (const [id, cached] of generatedActions.entries()) {
      tasksMap += `  [${JSON.stringify(id)}]: ${cached.code},\n`;
    }
    tasksMap += `};\n`;

    let pathsList = `export const paths = [\n`;
    fileDef.paths.forEach((resolvedPath) => {
      const taskIds = resolvedPath.tasks
        .map((t) => JSON.stringify(t.id))
        .join(", ");
      pathsList += `  [${taskIds}],\n`;
    });
    pathsList += `];\n`;

    const bodyContent =
      `import type { TestAPI } from "@libs/executor";\n\n` +
      tasksMap +
      `\n` +
      pathsList;

    const yamlHash = crypto.createHash("sha256").update(content).digest("hex");

    const fileContent = `// hash: ${yamlHash}\n` + bodyContent;

    fs.writeFileSync(outputPath, fileContent, "utf-8");

    return {
      success: true,
      outputPath,
      generatedCode: fileContent,
      pathsResolved: fileDef.paths.length,
    };
  } finally {
    if (client) {
      console.log(`[Compiler] Stopping agent client...`);
      await client.close();
    }
  }
}
