import Electrobun from "electrobun/bun";
import { onWorkspaceChanged, WORKSPACE_DIR } from "./utils";
import { createMainWindow } from "./window/main-window";
import {
  updateApplicationMenu,
  registerMenuClickListener,
} from "./window/menu";
import { openWorkspace } from "./rpc/handlers/workspace-handlers";

// Boot up Electrobun window
const mainWindow = await createMainWindow();

onWorkspaceChanged(() => {
  mainWindow.webview.rpc?.send.workspaceChanged({ params: {} });
});

if (WORKSPACE_DIR) {
  await openWorkspace(WORKSPACE_DIR);
} else {
  updateApplicationMenu();
}

registerMenuClickListener();

console.log("Provar Editor started!");
