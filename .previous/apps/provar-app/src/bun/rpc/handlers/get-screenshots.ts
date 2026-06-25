import * as fs from "fs";
import * as path from "path";
import { loadProject } from "@libs/engine";
import { PROVAR_DIR, TESTS_DIR } from "@libs/config/paths";
import { getAbsPath, PROJECT_DIR } from "../../utils";
import { debug } from "../../../shared/debug";

export const getScreenshots = async (params: {
  testPath: string;
  pathIndex: number;
  taskId: string;
}) => {
  const absPath = getAbsPath(params.testPath);
  debug("[RPC Server] getScreenshots request:", {
    testPath: absPath,
    pathIndex: params.pathIndex,
    taskId: params.taskId,
  });
  try {
    const project = await loadProject(absPath);
    const execFile = await project.readFile(absPath);
    const selectedPath = execFile.paths[params.pathIndex];
    if (!selectedPath) {
      console.warn(
        "[RPC Server] getScreenshots warning: path not found at index:",
        params.pathIndex,
      );
      return {};
    }

    const testsDir = path.join(PROJECT_DIR, TESTS_DIR);
    const relativePath = path
      .relative(testsDir, absPath)
      .replace(".test.yml", "");
    const pathNameSlug = selectedPath.tasks
      .map((t) => t.id.replace(/^task_/, ""))
      .join("-");

    const taskIndex = selectedPath.tasks.findIndex(
      (t) => t.id === params.taskId,
    );
    if (taskIndex === -1) {
      console.warn(
        "[RPC Server] getScreenshots warning: task not found in path:",
        params.taskId,
      );
      return {};
    }

    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
    const shortTaskId = params.taskId.replace(/^task_/, "");

    const screenshotFile = `${stepIndexStr}_${shortTaskId}.png`;
    const currentFilePath = path.join(
      PROJECT_DIR,
      PROVAR_DIR,
      "screenshots",
      "current",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );
    const acceptedFilePath = path.join(
      PROJECT_DIR,
      PROVAR_DIR,
      "screenshots",
      "accepted",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );

    const res: { baseline?: string; current?: string } = {};

    if (fs.existsSync(acceptedFilePath)) {
      res.baseline = `data:image/png;base64,${fs.readFileSync(acceptedFilePath).toString("base64")}`;
    }
    if (fs.existsSync(currentFilePath)) {
      res.current = `data:image/png;base64,${fs.readFileSync(currentFilePath).toString("base64")}`;
    }

    debug(
      "[RPC Server] getScreenshots response baseline exists:",
      !!res.baseline,
      "current exists:",
      !!res.current,
    );
    return res;
  } catch (err) {
    console.error("[RPC Server] getScreenshots error:", err);
    return {};
  }
};
