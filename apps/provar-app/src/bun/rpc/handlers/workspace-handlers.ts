import { Utils } from "electrobun/bun";
import { setWorkspaceDir, WORKSPACE_DIR } from "../../utils";
import { loadSettings, saveSettings } from "../../lib/settings";
import { getMainWindow } from "../../window/window-registry";

let updateMenuCallback: (() => void) | null = null;
export function registerUpdateMenuCallback(cb: () => void) {
  updateMenuCallback = cb;
}

export async function openWorkspace(workspacePath: string) {
  if (!workspacePath) return;

  setWorkspaceDir(workspacePath);
  const mainWindow = getMainWindow();
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

    if (updateMenuCallback) {
      updateMenuCallback();
    }
  } catch (e) {
    console.error("Failed to update recent workspaces settings:", e);
  }
}

export const selectWorkspace = async () => {
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
};

export const getWorkspace = async () => {
  console.log("[RPC Server] getWorkspace request");
  const res = { path: WORKSPACE_DIR };
  console.log("[RPC Server] getWorkspace response:", res);
  return res;
};
