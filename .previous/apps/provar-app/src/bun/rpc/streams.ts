import { type Runner } from "@libs/engine";
import { SteamBun } from "@thani-sh/steam-bun/bun";
import {
  assistEditorStream,
  compileTestStream,
  runTestPathStream,
} from "../../shared/streams";
import {
  createClient,
  convertCommandsToTools,
  type Message,
} from "@libs/models";
import { createCommands } from "../commands";
import { PROJECT_DIR, getAbsPath } from "../utils";
import { getAgentConfig } from "./context";
import { compileProgress, execute, loadProject } from "@libs/engine";
import { PROVAR_DIR, TESTS_DIR } from "@libs/config/paths";
import * as path from "path";
import * as fs from "fs";
import { debug } from "../../shared/debug";

const getCommands = () => createCommands({ projectDir: PROJECT_DIR });

/**
 * activeRunners maps the webview-visible `runId` to the in-process `Runner`
 * so the `cancelRun` RPC can find the right instance when the user hits the
 * Stop button. Entries are inserted when `runTestPathStream` starts and
 * removed when the event iterator completes (success, failure, or cancel).
 */
const activeRunners = new Map<string, Runner>();

/**
 * registerActiveRun and clearActiveRun are the only callers allowed to
 * touch the `activeRunners` map; keeping the mutation here makes it easy
 * to audit the lifecycle.
 */
function registerActiveRun(runId: string, runner: Runner): void {
  activeRunners.set(runId, runner);
}

function clearActiveRun(runId: string): void {
  activeRunners.delete(runId);
}

/**
 * cancelRun stops an in-flight test run by `runId`. The webview toolbar's
 * Stop button hits this RPC; the matching `Runner.cancel()` propagates the
 * cancellation to the underlying task sequence, which surfaces as a
 * `run-finished` event with `status: "cancelled"` on the existing stream.
 *
 * Returns `{ success: false }` when no active runner matches the id — this
 * happens when the run finished between the Stop click and the RPC
 * arriving, or when the id is unknown to this process (defensive).
 */
export async function cancelRun(params: { runId: string }): Promise<{
  success: boolean;
}> {
  const runner = activeRunners.get(params.runId);
  if (!runner) {
    return { success: false };
  }
  await runner.cancel();
  return { success: true };
}

export function registerStreams() {
  // 1. Assist Editor Stream
  SteamBun.register(assistEditorStream, (input) => {
    return new ReadableStream({
      async start(controller) {
        const reader = input.getReader();
        const { done, value: params } = await reader.read();
        if (done || !params) {
          controller.close();
          return;
        }

        let client;
        try {
          client = createClient(getAgentConfig());
          const commands = getCommands();
          const tools = convertCommandsToTools(commands);
          const session = await client.session({ tools });

          const messages: Message[] = (params.history || []).map((h) => ({
            role: h.role,
            content: h.content,
          }));
          messages.push({
            role: "user",
            content: params.prompt,
          });

          for await (const chunk of session.prompt(messages)) {
            if (chunk.type === "text" && chunk.text) {
              controller.enqueue({
                text: chunk.text,
                status: "pending",
              });
            }
          }

          controller.enqueue({
            text: "",
            status: "completed",
          });
          controller.close();
        } catch (err: any) {
          console.error("[RPC Stream Server] assistEditor error:", err);
          controller.enqueue({
            text: `\nError: ${err.message}`,
            status: "error",
          });
          controller.close();
        } finally {
          if (client) {
            await client.close();
          }
        }
      },
    });
  });

  // 2. Compile Test Stream
  SteamBun.register(compileTestStream, (input) => {
    return new ReadableStream({
      async start(controller) {
        const reader = input.getReader();
        const { done, value: params } = await reader.read();
        if (done || !params) {
          controller.close();
          return;
        }

        try {
          const absPath = getAbsPath(params.path);
          const generator = compileProgress({
            yamlPath: absPath,
            agentConfig: getAgentConfig(),
          });

          for await (const event of generator) {
            controller.enqueue({
              yamlPath: absPath,
              type: event.type,
              nodeId: "nodeId" in event ? event.nodeId : undefined,
              title: "title" in event ? event.title : undefined,
              error: "error" in event ? event.error : undefined,
            });
          }
          controller.close();
        } catch (err: any) {
          console.error("[RPC Stream Server] compileTest error:", err);
          controller.close();
        }
      },
    });
  });

  // 3. Run Test Path Stream
  SteamBun.register(runTestPathStream, (input) => {
    return new ReadableStream({
      async start(controller) {
        const reader = input.getReader();
        const { done, value: params } = await reader.read();
        if (done || !params) {
          controller.close();
          return;
        }

        try {
          const absPath = getAbsPath(params.path);
          let project = await loadProject(absPath);
          const loadedFile = project.files.find((f) => f.path === absPath);
          const needCompile =
            !loadedFile || !loadedFile.code || !loadedFile.code.valid;

          if (needCompile) {
            debug(`[Auto-Compile] Compiling out of sync test: ${absPath}`);
            const compileRes = await compileProgress({
              yamlPath: absPath,
              agentConfig: getAgentConfig(),
            });
            let compileSuccess = false;
            for await (const event of compileRes) {
              if (event.type === "compile-finished") {
                compileSuccess = event.success;
              }
            }
            if (!compileSuccess) {
              throw new Error(
                "Auto-compilation failed. Please compile manually to check errors.",
              );
            }
            project = await loadProject(absPath);
          }

          const execFile = await project.readFile(absPath);
          if (
            params.pathIndex < 0 ||
            params.pathIndex >= execFile.paths.length
          ) {
            throw new Error(`Invalid path index ${params.pathIndex}`);
          }

          const selectedPath = execFile.paths[params.pathIndex];
          if (!selectedPath) {
            throw new Error(`Path at index ${params.pathIndex} not found`);
          }

          const runId = Math.random().toString(36).substring(7);
          const runner = await execute(selectedPath, {
            headless: params.headless !== false,
            variables: project.variables,
            upToTaskId: params.upToTaskId,
            provarPath: project.path,
          });

          // Make the runner reachable by the `cancelRun` RPC for the
          // duration of the run; the IIFE below removes it once the
          // event iterator drains.
          registerActiveRun(runId, runner);

          // Handle runner events
          const testsDir = path.join(PROJECT_DIR, TESTS_DIR);
          const relativePath = path
            .relative(testsDir, absPath)
            .replace(".test.yml", "");
          const pathNameSlug = selectedPath.tasks
            .map((t) => t.id.replace(/^task_/, ""))
            .join("-");

          // Process runner events async generator
          (async () => {
            try {
              for await (const event of runner.events()) {
                if (event.type === "visual-comparison-triggered") {
                  try {
                    const taskIndex = selectedPath.tasks.findIndex(
                      (t) => t.id === event.taskId,
                    );
                    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
                    const taskId = event.taskId.replace(/^task_/, "");

                    const currentDir = path.join(
                      PROJECT_DIR,
                      PROVAR_DIR,
                      "screenshots",
                      "current",
                      relativePath,
                      pathNameSlug,
                    );
                    fs.mkdirSync(currentDir, { recursive: true });
                    const currentFilePath = path.join(
                      currentDir,
                      `${stepIndexStr}_${taskId}.png`,
                    );
                    fs.writeFileSync(
                      currentFilePath,
                      Buffer.from(event.screenshotBase64, "base64"),
                    );
                  } catch (e) {
                    console.error("Error saving transient screenshot:", e);
                  }
                }

                controller.enqueue({
                  runId,
                  type: event.type,
                  taskId: "taskId" in event ? event.taskId : undefined,
                  title: "title" in event ? event.title : undefined,
                  error:
                    "error" in event
                      ? event.error instanceof Error
                        ? event.error.message
                        : String(event.error)
                      : undefined,
                  screenshotBase64:
                    "screenshotBase64" in event
                      ? event.screenshotBase64
                      : undefined,
                  visualCompare:
                    "visualCompare" in event ? event.visualCompare : undefined,
                  status: "status" in event ? event.status : undefined,
                });
              }

              const finalState = runner.getState();
              controller.enqueue({
                runId,
                type: "run-finished",
                status: finalState.status,
              });
              controller.close();
            } catch (err: any) {
              console.error(
                "[RPC Stream Server] runTestPath event stream error:",
                err,
              );
              controller.close();
            } finally {
              clearActiveRun(runId);
            }
          })();
        } catch (err: any) {
          console.error("[RPC Stream Server] runTestPath error:", err);
          controller.close();
        }
      },
    });
  });
}
