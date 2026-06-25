import { join, isAbsolute, relative, resolve } from "path";
import { watch, type FSWatcher } from "fs";

export let PROJECT_DIR = process.env.PROVAR_PROJECT_DIR || "";

let watcher: FSWatcher | null = null;
let watchCallback: (() => void) | null = null;

export const setProjectDir = (path: string) => {
  PROJECT_DIR = path;
  startWatching();
};

export const getAbsPath = (path: string) => {
  if (!PROJECT_DIR) {
    throw new Error("Project directory is not set");
  }
  const absPath = isAbsolute(path)
    ? resolve(path)
    : resolve(join(PROJECT_DIR, path));
  const relPath = relative(resolve(PROJECT_DIR), absPath);

  if (relPath.startsWith("..") || isAbsolute(relPath)) {
    throw new Error(
      `Path security violation: ${path} is outside of project directory`,
    );
  }
  return absPath;
};

export const onProjectChanged = (callback: () => void) => {
  watchCallback = callback;
};

let debounceTimer: any = null;

const startWatching = () => {
  if (watcher) {
    watcher.close();
  }

  if (!PROJECT_DIR) return;

  try {
    watcher = watch(PROJECT_DIR, { recursive: true }, (event, filename) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (watchCallback) {
          watchCallback();
        }
      }, 100);
    });
  } catch (e) {
    console.error("Failed to start watching project:", e);
  }
};

export const triggerProjectChanged = () => {
  if (watchCallback) {
    watchCallback();
  }
};
