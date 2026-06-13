import Electrobun from "electrobun/bun";
import { onProjectChanged, PROJECT_DIR } from "./utils";
import { createMainWindow } from "./window/main-window";
import {
  updateApplicationMenu,
  registerMenuClickListener,
} from "./window/menu";
import { openProject } from "./rpc/handlers/project-handlers";
import { provarRPC } from "./rpc";

// Boot up Electrobun window
const mainWindow = await createMainWindow();

onProjectChanged(() => {
  (mainWindow.webview.rpc as typeof provarRPC | undefined)?.send.projectChanged({ params: {} });
});

if (PROJECT_DIR) {
  await openProject({ path: PROJECT_DIR });
} else {
  updateApplicationMenu();
}

registerMenuClickListener();

console.log("Provar Editor started!");
