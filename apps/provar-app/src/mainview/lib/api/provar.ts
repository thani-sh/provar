import { electroview } from "./rpc";
import type { ProvarConfig, TestFile } from "@libs/domain/zod";
import type { Settings } from "../../../bun/lib/settings";

/**
 * ProvarAPI provides WebView client wrappers for interacting with Bun backend RPC methods.
 */
export const ProvarAPI = {
  /**
   * getSettings retrieves the application settings from disk.
   */
  async getSettings(): Promise<{ settings: Settings; home: string }> {
    console.log("[RPC Client] getSettings request");
    const res = await electroview.rpc!.request.getSettings({});
    console.log("[RPC Client] getSettings response:", res);
    return res;
  },

  /**
   * saveSettings updates the application configuration on disk.
   */
  async saveSettings(
    settings: Partial<Settings>,
  ): Promise<{ settings: Settings }> {
    console.log("[RPC Client] saveSettings request:", settings);
    const res = await electroview.rpc!.request.saveSettings({ settings });
    console.log("[RPC Client] saveSettings response:", res);
    return res;
  },

  /**
   * openWorkspace changes the active workspace directory in the backend.
   */
  async openWorkspace(path: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] openWorkspace request:", path);
    const res = await electroview.rpc!.request.openWorkspace({ path });
    console.log("[RPC Client] openWorkspace response:", res);
    return res;
  },

  /**
   * selectWorkspace prompts the native folder selector to choose a workspace directory.
   */
  async selectWorkspace(): Promise<{ success: boolean; path?: string }> {
    console.log("[RPC Client] selectWorkspace request");
    const res = await electroview.rpc!.request.selectWorkspace({});
    console.log("[RPC Client] selectWorkspace response:", res);
    return res;
  },

  /**
   * getWorkspace returns the current active workspace directory.
   */
  async getWorkspace(): Promise<{ path: string }> {
    console.log("[RPC Client] getWorkspace request");
    const res = await electroview.rpc!.request.getWorkspace({});
    console.log("[RPC Client] getWorkspace response:", res);
    return res;
  },

  /**
   * getConfig retrieves the loaded provar configuration.
   */
  async getConfig(): Promise<{ config: ProvarConfig | null }> {
    console.log("[RPC Client] getConfig request");
    const res = await electroview.rpc!.request.getConfig({});
    console.log("[RPC Client] getConfig response:", res);
    return res;
  },

  /**
   * saveConfig updates the loaded provar configuration.
   */
  async saveConfig(config: ProvarConfig): Promise<{ success: boolean }> {
    console.log("[RPC Client] saveConfig request:", config);
    const res = await electroview.rpc!.request.saveConfig({ config });
    console.log("[RPC Client] saveConfig response:", res);
    return res;
  },

  /**
   * listFiles scans the workspace to list all test yml files.
   */
  async listFiles(): Promise<{ tests: string[] }> {
    console.log("[RPC Client] listFiles request");
    const res = await electroview.rpc!.request.listFiles({});
    console.log("[RPC Client] listFiles response:", res);
    return res;
  },

  /**
   * readFile loads and parses the test file graph.
   */
  async readFile(path: string): Promise<{ content: TestFile }> {
    console.log("[RPC Client] readFile request:", path);
    const res = await electroview.rpc!.request.readFile({ path });
    console.log("[RPC Client] readFile response success:", !!res.content);
    return res;
  },

  /**
   * writeFile writes the updated test file graph to disk.
   */
  async writeFile(
    path: string,
    content: TestFile,
  ): Promise<{ success: boolean }> {
    console.log("[RPC Client] writeFile request:", path);
    const res = await electroview.rpc!.request.writeFile({ path, content });
    console.log("[RPC Client] writeFile response:", res);
    return res;
  },

  /**
   * createFile creates a new test graph definition.
   */
  async createFile(path: string, name: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] createFile request:", path, name);
    const res = await electroview.rpc!.request.createFile({ path, name });
    console.log("[RPC Client] createFile response:", res);
    return res;
  },

  /**
   * createDirectory creates a new directory in the workspace.
   */
  async createDirectory(path: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] createDirectory request:", path);
    const res = await electroview.rpc!.request.createDirectory({ path });
    console.log("[RPC Client] createDirectory response:", res);
    return res;
  },

  /**
   * deletePath removes a file or directory from the workspace.
   */
  async deletePath(path: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] deletePath request:", path);
    const res = await electroview.rpc!.request.deletePath({ path });
    console.log("[RPC Client] deletePath response:", res);
    return res;
  },

  /**
   * assistEditor dispatches prompt and history to the AI agent.
   */
  async assistEditor(
    prompt: string,
    history?: { role: "user" | "assistant"; content: string }[],
    path?: string,
  ): Promise<{
    message: string;
    action?: { type: "selectFile"; path: string };
  }> {
    console.log("[RPC Client] assistEditor request:", prompt, history, path);
    const res = await electroview.rpc!.request.assistEditor({
      prompt,
      history,
      path,
    });
    console.log("[RPC Client] assistEditor response:", res);
    return res;
  },

  /**
   * compileTest triggers task compilation on the given test file.
   */
  async compileTest(
    path: string,
  ): Promise<{ success: boolean; error?: string }> {
    console.log("[RPC Client] compileTest request:", path);
    const res = await electroview.rpc!.request.compileTest({ path });
    console.log("[RPC Client] compileTest response:", res);
    return res;
  },

  /**
   * runTestPath runs a single resolved path in a test graph.
   */
  async runTestPath(
    path: string,
    pathIndex: number,
    upToTaskId?: string,
    headless?: boolean,
  ): Promise<{ success: boolean; runId?: string; error?: string }> {
    console.log(
      "[RPC Client] runTestPath request:",
      path,
      pathIndex,
      upToTaskId,
      headless,
    );
    const res = await electroview.rpc!.request.runTestPath({
      path,
      pathIndex,
      upToTaskId,
      headless,
    });
    console.log("[RPC Client] runTestPath response:", res);
    return res;
  },

  /**
   * acceptVisualState promotes a dynamic task screenshot to the visual baseline.
   */
  async acceptVisualState(
    testPath: string,
    pathIndex: number,
    taskId: string,
  ): Promise<{ success: boolean }> {
    console.log(
      "[RPC Client] acceptVisualState request:",
      testPath,
      pathIndex,
      taskId,
    );
    const res = await electroview.rpc!.request.acceptVisualState({
      testPath,
      pathIndex,
      taskId,
    });
    console.log("[RPC Client] acceptVisualState response:", res);
    return res;
  },

  /**
   * getScreenshots retrieves the visual baseline and current run screenshots for a node.
   */
  async getScreenshots(
    testPath: string,
    pathIndex: number,
    taskId: string,
  ): Promise<{ baseline?: string; current?: string }> {
    console.log(
      "[RPC Client] getScreenshots request:",
      testPath,
      pathIndex,
      taskId,
    );
    const res = await electroview.rpc!.request.getScreenshots({
      testPath,
      pathIndex,
      taskId,
    });
    console.log(
      "[RPC Client] getScreenshots response (keys):",
      Object.keys(res),
    );
    return res;
  },
};
