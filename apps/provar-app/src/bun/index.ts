import Electrobun, {
  BrowserWindow,
  BrowserView,
  Updater,
  ApplicationMenu,
  Utils,
} from "electrobun/bun";
import { type ProvarRPCSchema } from "../shared/rpc";
import { getConfig } from "./commands/getConfig";
import { saveConfig } from "./commands/saveConfig";
import { listFiles } from "./commands/listFiles";
import { readFileCommand } from "./commands/readFile";
import { writeFileCommand } from "./commands/writeFile";
import { createFile } from "./commands/createFile";
import { createDirectory } from "./commands/createDirectory";
import { deletePath } from "./commands/deletePath";
import { assistEditor } from "./commands/assistEditor";
import {
  setWorkspaceDir,
  WORKSPACE_DIR,
  onWorkspaceChanged,
  getAbsPath,
} from "./utils";
import { compile } from "@libs/compiler";
import { loadProject } from "@libs/loader";
import { execute } from "@libs/executor";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

// Compilation handler
const compileTest = async (params: { path: string }) => {
  const absPath = getAbsPath(params.path);
  console.log("[RPC Server] compileTest request for:", absPath);
  try {
    const res = await compile({ yamlPath: absPath });
    console.log("[RPC Server] compileTest response success:", res.success);
    return { success: res.success };
  } catch (err: any) {
    console.error("[RPC Server] compileTest error:", err);
    return { success: false, error: err?.message || String(err) };
  }
};

// Execution session cache
const activeRunners = new Map<string, any>();

// Playwright execution runner
const runTestPath = async (params: {
  path: string;
  pathIndex: number;
  upToActionId?: string;
  headless?: boolean;
}) => {
  const absPath = getAbsPath(params.path);
  console.log("[RPC Server] runTestPath request parameters:", {
    ...params,
    path: absPath,
  });
  try {
    // Check synchronization and compile if out of sync
    const tsPath = absPath.replace(".test.yml", ".test.ts");
    let needCompile = !fs.existsSync(tsPath);
    if (!needCompile) {
      const yamlContent = fs.readFileSync(absPath, "utf-8");
      const yamlHash = crypto
        .createHash("sha256")
        .update(yamlContent)
        .digest("hex");
      const tsContent = fs.readFileSync(tsPath, "utf-8");
      const match = tsContent.match(/^\/\/ hash: ([a-f0-9]+)/);
      if (!match || match[1] !== yamlHash) {
        needCompile = true;
      }
    }

    if (needCompile) {
      console.log(`[Auto-Compile] Compiling out of sync test: ${absPath}`);
      const compileRes = await compile({ yamlPath: absPath });
      if (!compileRes.success) {
        throw new Error(
          "Auto-compilation failed. Please compile manually to check errors.",
        );
      }
    }

    const project = await loadProject(absPath);
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
      upToActionId: params.upToActionId,
    });

    activeRunners.set(runId, runner);

    // Asynchronously handle events from runner and stream to webview
    (async () => {
      const testsDir = path.join(WORKSPACE_DIR, ".provar", "tests");
      const relativePath = path
        .relative(testsDir, absPath)
        .replace(".test.yml", "");
      const pathNameSlug = selectedPath.tasks
        .map((t) => t.id.replace(/^action_/, ""))
        .join("-");

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
            const actionId = event.taskId.replace(/^action_/, "");

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
              `${stepIndexStr}_${actionId}.png`,
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

// Screenshot promotion
const acceptVisualState = async (params: {
  testPath: string;
  pathIndex: number;
  actionId: string;
}) => {
  const absPath = getAbsPath(params.testPath);
  console.log("[RPC Server] acceptVisualState request:", {
    ...params,
    testPath: absPath,
  });
  try {
    const project = await loadProject(absPath);
    const execFile = await project.readFile(absPath);
    const selectedPath = execFile.paths[params.pathIndex];
    if (!selectedPath) {
      return {
        success: false,
        error: `Path at index ${params.pathIndex} not found`,
      };
    }

    const testsDir = path.join(WORKSPACE_DIR, ".provar", "tests");
    const relativePath = path
      .relative(testsDir, absPath)
      .replace(".test.yml", "");
    const pathNameSlug = selectedPath.tasks
      .map((t) => t.id.replace(/^action_/, ""))
      .join("-");

    const taskIndex = selectedPath.tasks.findIndex(
      (t) => t.id === params.actionId,
    );
    if (taskIndex === -1) {
      console.error(
        "[RPC Server] acceptVisualState error: action not found in path:",
        params.actionId,
      );
      return {
        success: false,
        error: `Action ${params.actionId} not found in path`,
      };
    }
    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
    const shortActionId = params.actionId.replace(/^action_/, "");

    const screenshotFile = `${stepIndexStr}_${shortActionId}.png`;
    const currentFilePath = path.join(
      WORKSPACE_DIR,
      ".provar",
      "screenshots",
      "current",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );
    const acceptedFilePath = path.join(
      WORKSPACE_DIR,
      ".provar",
      "screenshots",
      "accepted",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );

    if (!fs.existsSync(currentFilePath)) {
      console.error(
        "[RPC Server] acceptVisualState error: current screenshot does not exist:",
        currentFilePath,
      );
      return {
        success: false,
        error: "Current screenshot does not exist. Run the test first.",
      };
    }

    fs.mkdirSync(path.dirname(acceptedFilePath), { recursive: true });
    fs.copyFileSync(currentFilePath, acceptedFilePath);

    console.log("[RPC Server] acceptVisualState response success: true");
    return { success: true };
  } catch (err: any) {
    console.error("[RPC Server] acceptVisualState error:", err);
    return { success: false, error: err?.message || String(err) };
  }
};

// Screenshot retrieval
const getScreenshots = async (params: {
  testPath: string;
  pathIndex: number;
  actionId: string;
}) => {
  const absPath = getAbsPath(params.testPath);
  console.log("[RPC Server] getScreenshots request:", {
    ...params,
    testPath: absPath,
  });
  try {
    const project = await loadProject(absPath);
    const execFile = await project.readFile(absPath);
    const selectedPath = execFile.paths[params.pathIndex];
    if (!selectedPath) {
      console.warn(
        "[RPC Server] getScreenshots warning: path not found at index:",
        params.pathIndex,
      );
      return {};
    }

    const testsDir = path.join(WORKSPACE_DIR, ".provar", "tests");
    const relativePath = path
      .relative(testsDir, absPath)
      .replace(".test.yml", "");
    const pathNameSlug = selectedPath.tasks
      .map((t) => t.id.replace(/^action_/, ""))
      .join("-");

    const taskIndex = selectedPath.tasks.findIndex(
      (t) => t.id === params.actionId,
    );
    if (taskIndex === -1) {
      console.warn(
        "[RPC Server] getScreenshots warning: action not found in path:",
        params.actionId,
      );
      return {};
    }

    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
    const shortActionId = params.actionId.replace(/^action_/, "");

    const screenshotFile = `${stepIndexStr}_${shortActionId}.png`;
    const currentFilePath = path.join(
      WORKSPACE_DIR,
      ".provar",
      "screenshots",
      "current",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );
    const acceptedFilePath = path.join(
      WORKSPACE_DIR,
      ".provar",
      "screenshots",
      "accepted",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );

    const res: { baseline?: string; current?: string } = {};

    if (fs.existsSync(acceptedFilePath)) {
      res.baseline = `data:image/png;base64,${fs.readFileSync(acceptedFilePath).toString("base64")}`;
    }
    if (fs.existsSync(currentFilePath)) {
      res.current = `data:image/png;base64,${fs.readFileSync(currentFilePath).toString("base64")}`;
    }

    console.log(
      "[RPC Server] getScreenshots response baseline exists:",
      !!res.baseline,
      "current exists:",
      !!res.current,
    );
    return res;
  } catch (err) {
    console.error("[RPC Server] getScreenshots error:", err);
    return {};
  }
};

const provarRPC = BrowserView.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    requests: {
      getConfig,
      getWorkspace: async () => ({ path: WORKSPACE_DIR }),
      saveConfig,
      listFiles,
      readFile: readFileCommand,
      writeFile: writeFileCommand,
      createFile,
      createDirectory,
      deletePath,
      compileTest,
      runTestPath,
      acceptVisualState,
      getScreenshots,
      assistEditor: (params: { prompt: string; path?: string }) =>
        assistEditor({
          ...params,
          onChunk: (text, status) => {
            mainWindow.webview.rpc?.send.assistantChunk({
              params: { text, status },
            });
          },
        }),
    },
  },
});

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "Provar Editor",
  url,
  renderer: "native",
  frame: {
    width: 1200,
    height: 800,
    x: 200,
    y: 200,
  },
  rpc: provarRPC,
  titleBarStyle: "hiddenInset",
});

onWorkspaceChanged(() => {
  mainWindow.webview.rpc?.send.workspaceChanged({ params: {} });
});

if (WORKSPACE_DIR) {
  setWorkspaceDir(WORKSPACE_DIR);
}

ApplicationMenu.setApplicationMenu([
  {
    label: "File",
    submenu: [
      {
        label: "Open...",
        action: "open",
        accelerator: "o",
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
]);

Electrobun.events.on("application-menu-clicked", async (e) => {
  if (e.data.action === "open") {
    const chosenPaths = await Utils.openFileDialog({
      canChooseFiles: false,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    });

    if (chosenPaths && chosenPaths.length > 0 && chosenPaths[0]) {
      const newWorkspace = chosenPaths[0];
      setWorkspaceDir(newWorkspace);
      mainWindow.webview.rpc?.send.workspaceSelected({
        params: { path: newWorkspace },
      });
    }
  }
});

console.log("Provar Editor started!");
