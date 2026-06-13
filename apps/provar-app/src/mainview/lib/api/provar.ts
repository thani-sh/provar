import { electroview } from "./rpc";
import type { ProvarConfig, TestFile } from "@libs/domain/zod";
import type { Settings } from "../../../bun/lib/settings";
import { SteamBun } from "@thani-sh/steam-bun/web";
import {
  assistEditorStream,
  compileTestStream,
  runTestPathStream,
} from "../../../shared/streams";

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
   * openProject changes the active project directory in the backend.
   */
  async openProject(params: { path: string }): Promise<{ success: boolean }> {
    console.log("[RPC Client] openProject request:", params);
    const res = await electroview.rpc!.request.openProject(params);
    console.log("[RPC Client] openProject response:", res);
    return res;
  },

  /**
   * selectProject prompts the native folder selector to choose a project directory.
   */
  async selectProject(): Promise<{ success: boolean; path?: string }> {
    console.log("[RPC Client] selectProject request");
    const res = await electroview.rpc!.request.selectProject({});
    console.log("[RPC Client] selectProject response:", res);
    return res;
  },

  /**
   * getProject returns the current active project directory.
   */
  async getProject(): Promise<{ path: string }> {
    console.log("[RPC Client] getProject request");
    const res = await electroview.rpc!.request.getProject({});
    console.log("[RPC Client] getProject response:", res);
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
   * listFiles scans the project to list all test yml files.
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
   * createDirectory creates a new directory in the project.
   */
  async createDirectory(path: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] createDirectory request:", path);
    const res = await electroview.rpc!.request.createDirectory({ path });
    console.log("[RPC Client] createDirectory response:", res);
    return res;
  },

  /**
   * deletePath removes a file or directory from the project.
   */
  async deletePath(path: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] deletePath request:", path);
    const res = await electroview.rpc!.request.deletePath({ path });
    console.log("[RPC Client] deletePath response:", res);
    return res;
  },

  /**
   * assistEditor dispatches prompt and history to the AI agent and returns a stream.
   */
  assistEditor(
    prompt: string,
    history?: { role: "user" | "assistant"; content: string }[],
    path?: string,
  ) {
    console.log(
      "[RPC Client] assistEditor Stream request:",
      prompt,
      history,
      path,
    );
    const { rx, tx } = SteamBun.create(assistEditorStream);
    const writer = tx.getWriter();
    writer.write({ prompt, history, path });
    writer.close();
    return rx;
  },

  /**
   * compileTest triggers task compilation on the given test file and returns a stream.
   */
  compileTest(path: string) {
    console.log("[RPC Client] compileTest Stream request:", path);
    const { rx, tx } = SteamBun.create(compileTestStream);
    const writer = tx.getWriter();
    writer.write({ path });
    writer.close();
    return rx;
  },

  /**
   * runTestPath runs a single resolved path in a test graph and returns a stream.
   */
  runTestPath(
    path: string,
    pathIndex: number,
    upToTaskId?: string,
    headless?: boolean,
  ) {
    console.log(
      "[RPC Client] runTestPath Stream request:",
      path,
      pathIndex,
      upToTaskId,
      headless,
    );
    const { rx, tx } = SteamBun.create(runTestPathStream);
    const writer = tx.getWriter();
    writer.write({ path, pathIndex, upToTaskId, headless });
    writer.close();
    return rx;
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
