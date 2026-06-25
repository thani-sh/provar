import { isAbsolute } from "path";
import { Utils } from "electrobun/bun";
import { setProjectDir, PROJECT_DIR } from "../../utils";
import { loadSettings, saveSettings } from "../../lib/settings";
import { getMainWindow } from "../../window/window-registry";
import { provarRPC } from "../../rpc";
import { debug } from "../../../shared/debug";

let updateMenuCallback: (() => void) | null = null;
export function registerUpdateMenuCallback(cb: () => void) {
  updateMenuCallback = cb;
}

/**
 * openProject changes the active project directory, updates settings, and updates the application menu.
 *
 * Defense-in-depth: the project path is the root for the FS watcher and for all path-traversal
 * checks downstream. Validate it is absolute and contains no `..` segments before accepting it.
 * (See docs/PRODUCT.md § 5 — local by default; only audit-able, user-initiated paths are honored.)
 */
export async function openProject(params: { path: string }) {
  const { path: projectPath } = params;
  if (!projectPath) return { success: false };
  if (!isAbsolute(projectPath) || projectPath.includes("..")) {
    console.error(`openProject rejected invalid path: ${projectPath}`);
    return { success: false };
  }

  setProjectDir(projectPath);
  const mainWindow = getMainWindow();
  (mainWindow.webview.rpc as typeof provarRPC | undefined)?.send.projectOpened({
    params: { path: projectPath },
  });

  try {
    const settings = loadSettings();
    const recents = settings.recentProjects || [];
    const updatedRecents = [
      projectPath,
      ...recents.filter((p) => p !== projectPath),
    ].slice(0, 3);

    saveSettings({
      recentProjects: updatedRecents,
    });

    if (updateMenuCallback) {
      updateMenuCallback();
    }
  } catch (e) {
    console.error("Failed to update recent projects settings:", e);
  }

  return { success: true };
}

export const selectProject = async () => {
  debug("[RPC Server] selectProject request");
  const chosenPaths = await Utils.openFileDialog({
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });

  if (chosenPaths && chosenPaths.length > 0 && chosenPaths[0]) {
    const newProject = chosenPaths[0];
    await openProject({ path: newProject });
    return { success: true, path: newProject };
  }
  return { success: false };
};

export const getProject = async () => {
  debug("[RPC Server] getProject request");
  const res = { path: PROJECT_DIR };
  debug("[RPC Server] getProject response:", res);
  return res;
};
