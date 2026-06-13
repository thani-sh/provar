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

/**
 * CompilerOptions contains parameters for running the task generation compiler on a test YAML file.
 */
export interface CompilerOptions {
  yamlPath: string;
  outputPath?: string;
  agentConfig: AgentClientConfig;
}

/**
 * CompileResult contains output status, resolved paths count, and telemetry trace info from the compile run.
 */
export interface CompileResult {
  success: boolean;
  outputPath: string;
  generatedCode: string;
  pathsResolved: number;
  trace?: CompilationTrace;
}

/**
 * CompileEvent represents progress notifications emitted during compilation.
 */
export type CompileEvent =
  | { type: "compile-started" }
  | { type: "node-started"; nodeId: string; title: string }
  | { type: "node-succeeded"; nodeId: string; title: string }
  | { type: "node-failed"; nodeId: string; title: string; error: string }
  | { type: "compile-finished"; success: boolean; result: CompileResult };

/**
 * compileProgress runs the compilation process and yields CompileEvents incrementally.
 */
export async function* compileProgress(
  options: CompilerOptions,
): AsyncGenerator<CompileEvent, CompileResult, void> {
  yield { type: "compile-started" };

  const tracker = new CompilerPerformanceTracker(options.yamlPath);
  tracker.start();

  tracker.startParse();
  const content = fs.readFileSync(options.yamlPath, "utf-8");
  const fileDef = parseTestFile(content, options.yamlPath);
  tracker.endParse();

  const outputPath =
    options.outputPath ?? options.yamlPath.replace(".test.yml", ".test.ts");

  // Load project to determine project root directory
  tracker.startSetup();
  let projectDir = process.cwd();
  try {
    const project = await loadProject(options.yamlPath);
    projectDir = path.dirname(project.path);
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
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Compiler Error] Failed to start agent: ${errMsg}`);
    const result: CompileResult = {
      success: false,
      outputPath,
      generatedCode: "",
      pathsResolved: 0,
    };
    yield {
      type: "compile-finished",
      success: false,
      result,
    };
    throw new Error(`Failed to initialize agent client: ${errMsg}`);
  }

  tracker.endSetup();

  const generatedTasks = new Map<string, { code: string; title: string }>();

  // Initialize incremental stateful grounding session
  const groundingSession = new CompilerGroundingSession(true);

  try {
    // Sequential recursive node compilation in correct path prefix context
    async function* compileNodeRecursively(
      nodeId: string,
      node: Task,
      prefixTasks: string[],
    ): AsyncGenerator<CompileEvent, void, void> {
      if (generatedTasks.has(nodeId)) {
        return;
      }

      yield { type: "node-started", nodeId, title: node.title };

      try {
        if (node.graph) {
          const innerTasks = node.graph.tasks;
          const innerPaths = node.graph.paths;
          const primaryPath = innerPaths[0]?.tasks || [];

          let subPrefix = [...prefixTasks];
          for (const subTask of primaryPath) {
            yield* compileNodeRecursively(subTask.id, subTask, subPrefix);
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
        yield { type: "node-succeeded", nodeId, title: node.title };
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        yield { type: "node-failed", nodeId, title: node.title, error: errMsg };
        throw err;
      }
    }

    // Iterate over paths and recursively compile task nodes chronologically
    for (const resolvedPath of fileDef.paths) {
      const prefix: string[] = [];
      for (const task of resolvedPath.tasks) {
        yield* compileNodeRecursively(task.id, task, prefix);
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

    const result: CompileResult = {
      success: true,
      outputPath,
      generatedCode: fileContent,
      pathsResolved: fileDef.paths.length,
      trace,
    };

    yield {
      type: "compile-finished",
      success: true,
      result,
    };

    return result;
  } catch (err: any) {
    const result: CompileResult = {
      success: false,
      outputPath,
      generatedCode: "",
      pathsResolved: 0,
    };
    yield {
      type: "compile-finished",
      success: false,
      result,
    };
    throw err;
  } finally {
    // Make sure we close stateful session to prevent leaking processes!
    await groundingSession.close();

    if (client) {
      console.log(`[Compiler] Stopping agent client...`);
      await client.close();
    }
  }
}

/**
 * compile processes a single test definition file and compiles its tasks into executable TypeScript Playwright functions.
 */
export async function compile(
  options: CompilerOptions,
): Promise<CompileResult> {
  const generator = compileProgress(options);
  let result: CompileResult | undefined;
  for await (const event of generator) {
    if (event.type === "compile-finished") {
      result = event.result;
    }
  }
  if (!result) {
    throw new Error("Compilation did not yield a finished event");
  }
  return result;
}
