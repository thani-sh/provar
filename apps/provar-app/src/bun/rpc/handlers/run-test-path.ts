import * as fs from "fs";
import * as path from "path";
import { execute, compile, loadProject } from "@libs/engine";
import { getAbsPath, WORKSPACE_DIR } from "../../utils";
import { getAgentConfig, activeRunners } from "../context";
import { getMainWindow } from "../../window/window-registry";

export const runTestPath = async (params: {
  path: string;
  pathIndex: number;
  upToTaskId?: string;
  headless?: boolean;
}) => {
  const absPath = getAbsPath(params.path);
  console.log("[RPC Server] runTestPath request parameters:", {
    ...params,
    path: absPath,
  });
  try {
    // Check synchronization and compile if out of sync
    let project = await loadProject(absPath);
    const loadedFile = project.files.find((f) => f.path === absPath);
    const needCompile =
      !loadedFile || !loadedFile.code || !loadedFile.code.valid;

    if (needCompile) {
      console.log(`[Auto-Compile] Compiling out of sync test: ${absPath}`);
      const compileRes = await compile({
        yamlPath: absPath,
        agentConfig: getAgentConfig(),
      });
      if (!compileRes.success) {
        throw new Error(
          "Auto-compilation failed. Please compile manually to check errors.",
        );
      }
      // Reload the project after compilation to ensure file and code status are updated
      project = await loadProject(absPath);
    }

    const execFile = await project.readFile(absPath);

    if (params.pathIndex < 0 || params.pathIndex >= execFile.paths.length) {
      console.error("[RPC Server] runTestPath error: invalid path index");
      return {
        success: false,
        error: `Invalid path index ${params.pathIndex}`,
      };
    }

    const selectedPath = execFile.paths[params.pathIndex];
    if (!selectedPath) {
      return {
        success: false,
        error: `Path at index ${params.pathIndex} not found`,
      };
    }
    const runId = Math.random().toString(36).substring(7);

    console.log(
      "[RPC Server] Spawning path runner, selected path task count:",
      selectedPath.tasks.length,
    );
    const runner = await execute(selectedPath, {
      headless: params.headless !== false,
      variables: project.variables,
      upToTaskId: params.upToTaskId,
      provarPath: project.path,
    });

    activeRunners.set(runId, runner);

    // Asynchronously handle events from runner and stream to webview
    (async () => {
      const testsDir = path.join(WORKSPACE_DIR, ".provar", "tests");
      const relativePath = path
        .relative(testsDir, absPath)
        .replace(".test.yml", "");
      const pathNameSlug = selectedPath.tasks
        .map((t) => t.id.replace(/^task_/, ""))
        .join("-");

      const mainWindow = getMainWindow();

      for await (const event of runner.events()) {
        console.log(
          `[RPC Server] Runner Event: ${event.type} for runId: ${runId}`,
          "taskId" in event ? event.taskId : "",
        );
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

        mainWindow.webview.rpc?.send.testRunEvent({
          params: {
            runId,
            type: event.type,
            taskId: "taskId" in event ? event.taskId : undefined,
            title: "title" in event ? event.title : undefined,
            error:
              "error" in event
                ? event.error?.message || String(event.error)
                : undefined,
            screenshotBase64:
              "screenshotBase64" in event ? event.screenshotBase64 : undefined,
            visualCompare:
              "visualCompare" in event ? event.visualCompare : undefined,
          },
        });
      }

      // Explicitly send the run-finished event when events generator terminates
      const finalState = runner.getState();
      console.log(
        `[RPC Server] Runner loop ended for runId: ${runId}. Status: ${finalState.status}`,
      );
      mainWindow.webview.rpc?.send.testRunEvent({
        params: {
          runId,
          type: "run-finished",
          status: finalState.status,
        },
      });

      activeRunners.delete(runId);
    })().catch((err) => {
      console.error("Error in test run event loop:", err);
    });

    console.log("[RPC Server] runTestPath started successfully, runId:", runId);
    return { success: true, runId };
  } catch (err: any) {
    console.error("[RPC Server] runTestPath error:", err);
    return { success: false, error: err?.message || String(err) };
  }
};
