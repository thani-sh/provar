import Electrobun, { ApplicationMenu, Utils } from "electrobun/bun";
import { loadSettings, saveSettings } from "../lib/settings";
import { getMainWindow } from "./window-registry";
import { provarRPC } from "../rpc";
import {
  openWorkspace,
  registerUpdateMenuCallback,
} from "../rpc/handlers/workspace-handlers";

export function updateApplicationMenu() {
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

export function registerMenuClickListener() {
  Electrobun.events.on("application-menu-clicked", async (e) => {
    const mainWindow = getMainWindow();
    if (e.data.action === "settings") {
      (mainWindow.webview.rpc as typeof provarRPC | undefined)?.send.openSettings({ params: {} });
    } else if (e.data.action === "open") {
      const chosenPaths = await Utils.openFileDialog({
        canChooseFiles: false,
        canChooseDirectory: true,
        allowsMultipleSelection: false,
      });

      if (chosenPaths && chosenPaths.length > 0 && chosenPaths[0]) {
        const newWorkspace = chosenPaths[0];
        await openWorkspace({ path: newWorkspace });
      }
    } else if (e.data.action.startsWith("open-recent:")) {
      const path = e.data.action.substring("open-recent:".length);
      await openWorkspace({ path });
    } else if (e.data.action === "clear-recents") {
      try {
        saveSettings({ recentWorkspaces: [] });
        updateApplicationMenu();
        (mainWindow.webview.rpc as typeof provarRPC | undefined)?.send.settingsChanged({ params: {} });
      } catch (e) {
        console.error("Failed to clear recent workspaces settings:", e);
      }
    }
  });
}

registerUpdateMenuCallback(updateApplicationMenu);
