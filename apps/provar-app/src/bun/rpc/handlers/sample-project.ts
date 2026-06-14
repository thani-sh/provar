import { existsSync } from "fs";
import { mkdir, rm } from "fs/promises";
import { spawn } from "child_process";
import { dirname, isAbsolute, join } from "path";
import { Utils } from "electrobun/bun";
import { setProjectDir } from "../../utils";
import { loadSettings, saveSettings } from "../../lib/settings";
import { getMainWindow } from "../../window/window-registry";
import { provarRPC } from "../../rpc";

/**
 * createSampleProject prompts the user for a destination folder, clones the upstream
 * demo-social repository (https://github.com/thani-sh/demo-social) into a `demo-social/`
 * subfolder of the chosen destination, and opens it as the active project. The cloned repo is
 * a self-contained microblogging app with a 5-step login test already wired up against it.
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

  const projectRoot = join(destination, "demo-social");
  const repoUrl = "https://github.com/thani-sh/demo-social.git";

  // If a previous clone attempt left a half-empty folder behind, wipe it so the clone starts
  // from a clean slate. Refuse to clobber a non-empty destination unless it's our own previous
  // attempt — anything else means the user picked a folder that already has real content.
  if (existsSync(projectRoot)) {
    return {
      success: false,
      error: `A folder named "demo-social" already exists at ${destination}. Pick a different destination or remove that folder first.`,
    };
  }

  try {
    await mkdir(destination, { recursive: true });

    const cloneResult = await runClone(repoUrl, projectRoot);
    if (cloneResult.exitCode !== 0) {
      // Best-effort cleanup so a failed clone doesn't leave a partial `.git/` lying around.
      await rm(projectRoot, { recursive: true, force: true }).catch(() => {});
      return {
        success: false,
        error: `git clone failed (exit ${cloneResult.exitCode}): ${cloneResult.stderr || "no error output"}`,
      };
    }

    // Track in recents, mirroring openProject's behavior.
    const settings = loadSettings();
    const recents = settings.recentProjects || [];
    const updatedRecents = [
      projectRoot,
      ...recents.filter((p) => p !== projectRoot),
    ].slice(0, 3);
    try {
      saveSettings({ recentProjects: updatedRecents });
    } catch (e) {
      console.error("Failed to update recent projects settings:", e);
    }

    setProjectDir(projectRoot);
    const mainWindow = getMainWindow();
    (
      mainWindow.webview.rpc as typeof provarRPC | undefined
    )?.send.projectOpened({
      params: { path: projectRoot },
    });

    return { success: true, path: projectRoot };
  } catch (e) {
    console.error("Failed to create sample project:", e);
    await rm(projectRoot, { recursive: true, force: true }).catch(() => {});
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
};

/**
 * runClone shells out to `git clone` and resolves once the command exits. We avoid a git
 * library on purpose — cloning into a local path is the only thing we need, and the git CLI
 * is already a hard runtime dependency for Provar projects anyway. stdout/stderr are captured
 * so the caller can surface a useful error to the user.
 */
function runClone(
  url: string,
  destination: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["clone", url, destination], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });
}
