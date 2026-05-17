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
import { setWorkspaceDir, WORKSPACE_DIR, onWorkspaceChanged } from "./utils";

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
      assistEditor,
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
  mainWindow.webview.rpc?.send.workspaceChanged({});
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

    if (chosenPaths && chosenPaths.length > 0) {
      const newWorkspace = chosenPaths[0];
      setWorkspaceDir(newWorkspace);
      mainWindow.webview.rpc?.send.workspaceSelected({ path: newWorkspace });
    }
  }
});

console.log("Provar Editor started!");
