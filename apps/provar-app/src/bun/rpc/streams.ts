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
import { WORKSPACE_DIR, getAbsPath } from "../utils";
import { getAgentConfig } from "./context";
import { compileProgress, execute, loadProject } from "@libs/engine";
import * as path from "path";
import * as fs from "fs";

const getCommands = () => createCommands({ workspaceDir: WORKSPACE_DIR });

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
            console.log(
              `[Auto-Compile] Compiling out of sync test: ${absPath}`,
            );
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

          // Handle runner events
          const testsDir = path.join(WORKSPACE_DIR, ".provar", "tests");
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
                      WORKSPACE_DIR,
                      ".provar",
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
                      ? event.error?.message || String(event.error)
                      : undefined,
                  screenshotBase64:
                    "screenshotBase64" in event
                      ? event.screenshotBase64
                      : undefined,
                  visualCompare:
                    "visualCompare" in event ? event.visualCompare : undefined,
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
