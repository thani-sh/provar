import * as fs from "fs";
import * as path from "path";
import { loadProject } from "@libs/engine";
import { getAbsPath, PROJECT_DIR } from "../../utils";

export const acceptVisualState = async (params: {
  testPath: string;
  pathIndex: number;
  taskId: string;
}) => {
  const absPath = getAbsPath(params.testPath);
  console.log("[RPC Server] acceptVisualState request:", {
    ...params,
    testPath: absPath,
  });
  try {
    const project = await loadProject(absPath);
    const execFile = await project.readFile(absPath);
    const selectedPath = execFile.paths[params.pathIndex];
    if (!selectedPath) {
      return {
        success: false,
        error: `Path at index ${params.pathIndex} not found`,
      };
    }

    const testsDir = path.join(PROJECT_DIR, ".provar", "tests");
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
      console.error(
        "[RPC Server] acceptVisualState error: task not found in path:",
        params.taskId,
      );
      return {
        success: false,
        error: `Task ${params.taskId} not found in path`,
      };
    }
    const stepIndexStr = String(taskIndex + 1).padStart(3, "0");
    const shortTaskId = params.taskId.replace(/^task_/, "");

    const screenshotFile = `${stepIndexStr}_${shortTaskId}.png`;
    const currentFilePath = path.join(
      PROJECT_DIR,
      ".provar",
      "screenshots",
      "current",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );
    const acceptedFilePath = path.join(
      PROJECT_DIR,
      ".provar",
      "screenshots",
      "accepted",
      relativePath,
      pathNameSlug,
      screenshotFile,
    );

    if (!fs.existsSync(currentFilePath)) {
      console.error(
        "[RPC Server] acceptVisualState error: current screenshot does not exist:",
        currentFilePath,
      );
      return {
        success: false,
        error: "Current screenshot does not exist. Run the test first.",
      };
    }

    fs.mkdirSync(path.dirname(acceptedFilePath), { recursive: true });
    fs.copyFileSync(currentFilePath, acceptedFilePath);

    console.log("[RPC Server] acceptVisualState response success: true");
    return { success: true };
  } catch (err: any) {
    console.error("[RPC Server] acceptVisualState error:", err);
    return { success: false, error: err?.message || String(err) };
  }
};
