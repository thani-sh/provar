import { Utils } from "electrobun/bun";
import { setWorkspaceDir, WORKSPACE_DIR } from "../../utils";
import { loadSettings, saveSettings } from "../../lib/settings";
import { getMainWindow } from "../../window/window-registry";
import { provarRPC } from "..";
import { provarRPC } from "..";

let updateMenuCallback: (() => void) | null = null;
export function registerUpdateMenuCallback(cb: () => void) {
  updateMenuCallback = cb;
}

/**
 * openWorkspace opens the specified workspace directory and updates settings.
 */
export async function openWorkspace({
  path,
}: {
  path: string;
}): Promise<{ success: boolean }> {
  if (!path) {
    return { success: false };
  }

  setWorkspaceDir(path);
  const mainWindow = getMainWindow();
  (mainWindow.webview.rpc as typeof provarRPC | undefined)?.send.workspaceSelected({
    params: { path },
  });

  try {
    const settings = loadSettings();
    const recents = settings.recentWorkspaces || [];
    const updatedRecents = [path, ...recents.filter((p) => p !== path)].slice(
      0,
      3,
    );

    saveSettings({
      recentWorkspaces: updatedRecents,
    });

    if (updateMenuCallback) {
      updateMenuCallback();
    }
    return { success: true };
  } catch (e) {
    console.error("Failed to update recent workspaces settings:", e);
    return { success: false };
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
    await openWorkspace({ path: newWorkspace });
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
