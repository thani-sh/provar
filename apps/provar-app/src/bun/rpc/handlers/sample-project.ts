import { existsSync } from "fs";
import { cp, mkdir } from "fs/promises";
import { dirname, isAbsolute, join } from "path";
import { fileURLToPath } from "url";
import { Utils } from "electrobun/bun";
import { setProjectDir } from "../../utils";
import { loadSettings, saveSettings } from "../../lib/settings";
import { getMainWindow } from "../../window/window-registry";
import { provarRPC } from "../../rpc";

/**
 * createSampleProject prompts the user for a destination folder, copies the bundled sample
 * project into it, and opens it as the active project. The bundled sample lives at
 * `apps/provar-app/sample-projects/todo-app/` in the monorepo and contains a 5-step login flow
 * that runs against a local web app.
 */
export const createSampleProject = async () => {
  console.log("[RPC Server] createSampleProject request");

  const chosenPaths = await Utils.openFileDialog({
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });

  if (!chosenPaths || chosenPaths.length === 0 || !chosenPaths[0]) {
    return { success: false, error: "No destination selected" };
  }

  const destination = chosenPaths[0];

  // Defense-in-depth: the file dialog should only return absolute paths, but never trust IPC
  // input. (See docs/PRODUCT.md § 5 — local by default.)
  if (!isAbsolute(destination) || destination.includes("..")) {
    return { success: false, error: "Invalid destination path" };
  }

  const sampleSrc = resolveBundledSampleDir();
  if (!sampleSrc) {
    return {
      success: false,
      error:
        "Bundled sample project not found. Reinstall Provar or report this at https://github.com/thani-sh/provar/issues",
    };
  }

  try {
    await mkdir(destination, { recursive: true });
    await cp(sampleSrc, destination, { recursive: true });

    // Track in recents, mirroring openProject's behavior.
    const settings = loadSettings();
    const recents = settings.recentProjects || [];
    const updatedRecents = [
      destination,
      ...recents.filter((p) => p !== destination),
    ].slice(0, 3);
    try {
      saveSettings({ recentProjects: updatedRecents });
    } catch (e) {
      console.error("Failed to update recent projects settings:", e);
    }

    setProjectDir(destination);
    const mainWindow = getMainWindow();
    (mainWindow.webview.rpc as typeof provarRPC | undefined)?.send.projectOpened({
      params: { path: destination },
    });

    return { success: true, path: destination };
  } catch (e) {
    console.error("Failed to create sample project:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
};

/**
 * resolveBundledSampleDir returns the absolute path to the bundled sample project shipped with
 * the app package. Resolved relative to this file's location in the build output.
 */
function resolveBundledSampleDir(): string | null {
  try {
    // apps/provar-app/src/bun/rpc/handlers/sample-project.ts → monorepo root in dev.
    // In prod the file is bundled — search up the tree for the sample marker file.
    const here = dirname(fileURLToPath(import.meta.url));
    for (let dir = here; dir !== dirname(dir); dir = dirname(dir)) {
      const direct = join(dir, "sample-projects", "todo-app", ".provar");
      if (existsSync(direct)) {
        return join(dir, "sample-projects", "todo-app");
      }
      const monorepoStyle = join(
        dir,
        "apps",
        "provar-app",
        "sample-projects",
        "todo-app",
        ".provar",
      );
      if (existsSync(monorepoStyle)) {
        return join(dir, "apps", "provar-app", "sample-projects", "todo-app");
      }
    }
    return null;
  } catch {
    return null;
  }
}
