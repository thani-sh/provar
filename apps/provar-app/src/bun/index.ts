import Electrobun, {
  BrowserWindow,
  BrowserView,
  Updater,
  ApplicationMenu,
  Utils,
} from "electrobun/bun";
import { type ProvarRPCSchema } from "../shared/rpc";
import { createCommands } from "./commands";
import {
  createClient,
  convertCommandsToTools,
  type Message,
} from "@libs/models";
import { loadSettings, saveSettings } from "./lib/settings";
import {
  setWorkspaceDir,
  WORKSPACE_DIR,
  onWorkspaceChanged,
  getAbsPath,
  triggerWorkspaceChanged,
} from "./utils";
import { execute, compile, loadProject } from "@libs/engine";
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

function getAgentConfig() {
  const settings = loadSettings();
  const provider = settings.models.defaultProvider;
  const cfg = settings.models.providers[provider];
  return {
    provider,
    apiKey: cfg.apiKey,
    model: cfg.model,
    baseUrl: (cfg as any).baseUrl,
  };
}

// Compilation handler
const compileTest = async (params: { path: string }) => {
  const absPath = getAbsPath(params.path);
  console.log("[RPC Server] compileTest request for:", absPath);
  try {
    const res = await compile({ yamlPath: absPath, agentConfig: getAgentConfig() });
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
      const compileRes = await compile({ yamlPath: absPath, agentConfig: getAgentConfig() });
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

// Screenshot promotion
const acceptVisualState = async (params: {
  testPath: string;
  pathIndex: number;
  taskId: string;
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
      .map((t) => t.id.replace(/^task_/, ""))
      .join("-");

    const taskIndex = selectedPath.tasks.findIndex(
      (t) => t.id === params.taskId,
    );
    if (taskIndex === -1) {
      console.error(
        "[RPC Server] acceptVisualState error: task not found in path:",
        params.taskId,
      );
      return {
        success: false,
        error: `Task ${params.taskId} not found in path`,
      };
    }
    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
    const shortTaskId = params.taskId.replace(/^task_/, "");

    const screenshotFile = `${stepIndexStr}_${shortTaskId}.png`;
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
  taskId: string;
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
      .map((t) => t.id.replace(/^task_/, ""))
      .join("-");

    const taskIndex = selectedPath.tasks.findIndex(
      (t) => t.id === params.taskId,
    );
    if (taskIndex === -1) {
      console.warn(
        "[RPC Server] getScreenshots warning: task not found in path:",
        params.taskId,
      );
      return {};
    }

    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
    const shortTaskId = params.taskId.replace(/^task_/, "");

    const screenshotFile = `${stepIndexStr}_${shortTaskId}.png`;
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

const getCommands = () => createCommands({ workspaceDir: WORKSPACE_DIR });

function updateApplicationMenu() {
  const settings = loadSettings();
  const recents = settings.recentWorkspaces || [];
  const homeDir = Utils.paths.home;

  const recentItems = recents.map((p) => {
    const displayPath = p.startsWith(homeDir) ? p.replace(homeDir, "~") : p;
    return {
      label: displayPath,
      action: `open-recent:${p}`,
    };
  });

  if (recentItems.length === 0) {
    recentItems.push({
      label: "No Recent Workspaces",
      action: "no-recents",
      enabled: false,
    } as any);
  } else {
    recentItems.push({ type: "separator" } as any);
    recentItems.push({
      label: "Clear Recent",
      action: "clear-recents",
    } as any);
  }

  ApplicationMenu.setApplicationMenu([
    {
      label: "Provar Editor",
      submenu: [
        {
          label: "Settings...",
          action: "settings",
          accelerator: "cmd+,",
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Open...",
          action: "open",
          accelerator: "o",
        },
        {
          label: "Open Recent",
          submenu: recentItems,
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
  ]);
}

async function openWorkspace(workspacePath: string) {
  if (!workspacePath) return;

  setWorkspaceDir(workspacePath);
  mainWindow.webview.rpc?.send.workspaceSelected({
    params: { path: workspacePath },
  });

  try {
    const settings = loadSettings();
    const recents = settings.recentWorkspaces || [];
    const updatedRecents = [
      workspacePath,
      ...recents.filter((p) => p !== workspacePath),
    ].slice(0, 3);

    saveSettings({
      recentWorkspaces: updatedRecents,
    });

    updateApplicationMenu();
  } catch (e) {
    console.error("Failed to update recent workspaces settings:", e);
  }
}

const provarRPC = BrowserView.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    requests: {
      getSettings: async () => {
        console.log("[RPC Server] getSettings request");
        const settings = loadSettings();
        console.log("[RPC Server] getSettings response:", settings);
        return { settings, home: Utils.paths.home };
      },
      saveSettings: async (params) => {
        console.log("[RPC Server] saveSettings request:", params);
        const settings = saveSettings(params.settings);
        console.log("[RPC Server] saveSettings response:", settings);
        return { settings };
      },
      openWorkspace: async (params) => {
        console.log("[RPC Server] openWorkspace request:", params);
        await openWorkspace(params.path);
        return { success: true };
      },
      selectWorkspace: async () => {
        console.log("[RPC Server] selectWorkspace request");
        const chosenPaths = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });

        if (chosenPaths && chosenPaths.length > 0 && chosenPaths[0]) {
          const newWorkspace = chosenPaths[0];
          await openWorkspace(newWorkspace);
          return { success: true, path: newWorkspace };
        }
        return { success: false };
      },
      getConfig: async () => {
        console.log("[RPC Server] getConfig request");
        const res = await getCommands().getConfig.execute();
        console.log("[RPC Server] getConfig response:", res);
        return res;
      },
      getWorkspace: async () => {
        console.log("[RPC Server] getWorkspace request");
        const res = { path: WORKSPACE_DIR };
        console.log("[RPC Server] getWorkspace response:", res);
        return res;
      },
      saveConfig: async (params) => {
        console.log("[RPC Server] saveConfig request:", params);
        const res = await getCommands().saveConfig.execute(params);
        console.log("[RPC Server] saveConfig response:", res);
        return res;
      },
      listFiles: async () => {
        console.log("[RPC Server] listFiles request");
        const res = await getCommands().listFiles.execute();
        console.log(
          "[RPC Server] listFiles response test count:",
          res.tests.length,
        );
        return res;
      },
      readFile: async (params) => {
        console.log("[RPC Server] readFile request:", params);
        const res = await getCommands().readFile.execute(params);
        console.log("[RPC Server] readFile response success:", !!res.content);
        return res;
      },
      writeFile: async (params) => {
        console.log("[RPC Server] writeFile request:", params);
        const res = await getCommands().writeFile.execute(params);
        console.log("[RPC Server] writeFile response:", res);
        triggerWorkspaceChanged();
        return res;
      },
      createFile: async (params) => {
        console.log("[RPC Server] createFile request:", params);
        const res = await getCommands().createFile.execute(params);
        console.log("[RPC Server] createFile response:", res);
        triggerWorkspaceChanged();
        return res;
      },
      createDirectory: async (params) => {
        console.log("[RPC Server] createDirectory request:", params);
        const res = await getCommands().createDirectory.execute(params);
        console.log("[RPC Server] createDirectory response:", res);
        triggerWorkspaceChanged();
        return res;
      },
      deletePath: async (params) => {
        console.log("[RPC Server] deletePath request:", params);
        const res = await getCommands().deletePath.execute(params);
        console.log("[RPC Server] deletePath response:", res);
        triggerWorkspaceChanged();
        return res;
      },
      compileTest,
      runTestPath,
      acceptVisualState,
      getScreenshots,
      assistEditor: async (params: {
        prompt: string;
        history?: { role: "user" | "assistant"; content: string }[];
        path?: string;
      }) => {
        console.log("[RPC Server] assistEditor request:", params);
        try {
          const client = createClient(getAgentConfig());

          // Get commands for the workspace and map them to Vercel AI SDK tools
          const commands = getCommands();
          const tools = convertCommandsToTools(commands);

          const session = await client.session({ tools });

          // Map the history payload into agent-compatible Message objects
          const messages: Message[] = (params.history || []).map((h) => ({
            role: h.role,
            content: h.content,
          }));

          // Append current prompt as the last message
          messages.push({
            role: "user",
            content: params.prompt,
          });

          (async () => {
            try {
              for await (const chunk of session.prompt(messages)) {
                if (chunk.type === "text") {
                  mainWindow.webview.rpc?.send.assistantChunk({
                    params: {
                      text: chunk.text,
                      status: "pending",
                    },
                  });
                }
              }
              mainWindow.webview.rpc?.send.assistantChunk({
                params: {
                  text: "",
                  status: "completed",
                },
              });
            } catch (err: any) {
              console.error("[RPC Server] assistEditor stream error:", err);
              mainWindow.webview.rpc?.send.assistantChunk({
                params: {
                  text: `\nError: ${err.message}`,
                  status: "error",
                },
              });
            } finally {
              await client.close();
            }
          })();

          return {
            message: "",
          };
        } catch (err: any) {
          console.error("[RPC Server] assistEditor init error:", err);
          mainWindow.webview.rpc?.send.assistantChunk({
            params: {
              text: `Initialization Error: ${err.message}`,
              status: "error",
            },
          });
          return {
            message: `Initialization Error: ${err.message}`,
          };
        }
      },
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
  openWorkspace(WORKSPACE_DIR);
} else {
  updateApplicationMenu();
}

Electrobun.events.on("application-menu-clicked", async (e) => {
  if (e.data.action === "settings") {
    mainWindow.webview.rpc?.send.openSettings({ params: {} });
  } else if (e.data.action === "open") {
    const chosenPaths = await Utils.openFileDialog({
      canChooseFiles: false,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    });

    if (chosenPaths && chosenPaths.length > 0 && chosenPaths[0]) {
      const newWorkspace = chosenPaths[0];
      await openWorkspace(newWorkspace);
    }
  } else if (e.data.action.startsWith("open-recent:")) {
    const path = e.data.action.substring("open-recent:".length);
    await openWorkspace(path);
  } else if (e.data.action === "clear-recents") {
    try {
      saveSettings({ recentWorkspaces: [] });
      updateApplicationMenu();
      mainWindow.webview.rpc?.send.settingsChanged({ params: {} });
    } catch (e) {
      console.error("Failed to clear recent workspaces settings:", e);
    }
  }
});

console.log("Provar Editor started!");
