import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import type { Task, File } from "@libs/domain";
import { parseTestFile, loadProject } from "../loader";
import { createClient } from "@libs/models";
import type {
  Session,
  Attachment,
  Client,
  AgentClientConfig,
} from "@libs/models";
import type { GroundingContext, TestAPI } from "../types";

import { groundAndGenerateTask, CompilerGroundingSession } from "./generator";
import { CompilerPerformanceTracker, type CompilationTrace } from "./tracker";

export interface CompilerOptions {
  yamlPath: string;
  outputPath?: string;
  agentConfig: AgentClientConfig;
}

export interface CompileResult {
  success: boolean;
  outputPath: string;
  generatedCode: string;
  pathsResolved: number;
  trace?: CompilationTrace;
}

// Main compiler orchestrator
export async function compile(
  options: CompilerOptions,
): Promise<CompileResult> {
  const tracker = new CompilerPerformanceTracker(options.yamlPath);
  tracker.start();

  tracker.startParse();
  const content = fs.readFileSync(options.yamlPath, "utf-8");
  const fileDef = parseTestFile(content, options.yamlPath);
  tracker.endParse();

  const outputPath =
    options.outputPath ?? options.yamlPath.replace(".test.yml", ".test.ts");

  // Load project to determine workspace root directory
  tracker.startSetup();
  let workspaceDir = process.cwd();
  try {
    const project = await loadProject(options.yamlPath);
    workspaceDir = path.dirname(project.path);
  } catch (err) {
    // Ignore
  }

  let client: Client;
  let session: Session;
  try {
    console.log(
      `[Compiler] Starting agent client with provider: ${options.agentConfig.provider}`,
    );
    client = createClient(options.agentConfig);
    session = await client.session();
  } catch (err: any) {
    console.error(
      `[Compiler Error] Failed to start agent: ${err?.message || err}`,
    );
    throw new Error(
      `Failed to initialize agent client: ${err?.message || err}`,
    );
  }

  tracker.endSetup();

  const generatedTasks = new Map<string, { code: string; title: string }>();

  // Initialize incremental stateful grounding session
  const groundingSession = new CompilerGroundingSession(true);

  try {
    // Sequential recursive node compilation in correct path prefix context
    async function compileNodeRecursively(
      nodeId: string,
      node: Task,
      prefixTasks: string[],
    ) {
      if (generatedTasks.has(nodeId)) {
        return;
      }

      if (node.graph) {
        const innerTasks = node.graph.tasks;
        const innerPaths = node.graph.paths;
        const primaryPath = innerPaths[0]?.tasks || [];

        let subPrefix = [...prefixTasks];
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

        generatedTasks.set(nodeId, {
          code: executeBlock,
          title: node.title,
        });
      } else {
        const taskBody = await groundAndGenerateTask(
          options.yamlPath,
          nodeId,
          node,
          {
            prefixTasks,
            compiledTasksCache: generatedTasks,
            session,
            groundingSession,
            tracker,
          },
        );

        const formattedBody = taskBody
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n");
        const executeBlock = `async (api: TestAPI) => {\n${formattedBody}\n  }`;

        generatedTasks.set(nodeId, {
          code: executeBlock,
          title: node.title,
        });
      }
    }

    // Iterate over paths and recursively compile task nodes chronologically
    for (const resolvedPath of fileDef.paths) {
      const prefix: string[] = [];
      for (const task of resolvedPath.tasks) {
        await compileNodeRecursively(task.id, task, prefix);
        prefix.push(task.id);
      }
    }

    tracker.startWrite();
    let tasksMap = `export const tasks = {\n`;
    for (const [id, cached] of generatedTasks.entries()) {
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
      `import type { TestAPI } from "@libs/engine";\n\n` +
      tasksMap +
      `\n` +
      pathsList;

    const yamlHash = crypto.createHash("sha256").update(content).digest("hex");

    const fileContent = `// hash: ${yamlHash}\n` + bodyContent;

    fs.writeFileSync(outputPath, fileContent, "utf-8");
    tracker.endWrite();

    // End tracking, generate trace report, and write JSON next to output
    tracker.end();
    const trace = tracker.getTrace();
    const tracePath = outputPath.replace(".test.ts", ".trace.json");
    fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2), "utf-8");

    return {
      success: true,
      outputPath,
      generatedCode: fileContent,
      pathsResolved: fileDef.paths.length,
      trace,
    };
  } finally {
    // Make sure we close stateful session to prevent leaking processes!
    await groundingSession.close();

    if (client) {
      console.log(`[Compiler] Stopping agent client...`);
      await client.close();
    }
  }
}
