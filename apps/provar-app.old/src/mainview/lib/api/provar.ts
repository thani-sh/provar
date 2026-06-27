import { electroview } from "./rpc";
import type { ProvarConfig, TestFile } from "@libs/domain/zod";
import type { Settings } from "../../../bun/lib/settings";
import { SteamBun } from "@thani-sh/steam-bun/web";
import {
  assistEditorStream,
  compileTestStream,
  runTestPathStream,
} from "../../../shared/streams";
import { debug, debugRedacted } from "../../../shared/debug";

/**
 * ProvarAPI provides WebView client wrappers for interacting with Bun backend RPC methods.
 */
export const ProvarAPI = {
  /**
   * getSettings retrieves the application settings from disk, the user's
   * home directory, and whether the on-disk settings file already exists.
   */
  async getSettings(): Promise<{
    settings: Settings;
    home: string;
    settingsExists: boolean;
  }> {
    debug("[RPC Client] getSettings request");
    const res = await electroview.rpc!.request.getSettings({});
    debugRedacted("[RPC Client] getSettings response:", res);
    return res;
  },

  /**
   * saveSettings updates the application configuration on disk.
   */
  async saveSettings(
    settings: Partial<Settings>,
  ): Promise<{ settings: Settings }> {
    debugRedacted("[RPC Client] saveSettings request:", { settings });
    const res = await electroview.rpc!.request.saveSettings({ settings });
    debugRedacted("[RPC Client] saveSettings response:", res);
    return res;
  },

  /**
   * openProject changes the active project directory in the backend.
   */
  async openProject(params: { path: string }): Promise<{ success: boolean }> {
    debug("[RPC Client] openProject request:", params);
    const res = await electroview.rpc!.request.openProject(params);
    debug("[RPC Client] openProject response:", res);
    return res;
  },

  /**
   * selectProject prompts the native folder selector to choose a project directory.
   */
  async selectProject(): Promise<{ success: boolean; path?: string }> {
    debug("[RPC Client] selectProject request");
    const res = await electroview.rpc!.request.selectProject({});
    debug("[RPC Client] selectProject response:", res);
    return res;
  },

  /**
   * getProject returns the current active project directory.
   */
  async getProject(): Promise<{ path: string }> {
    debug("[RPC Client] getProject request");
    const res = await electroview.rpc!.request.getProject({});
    debug("[RPC Client] getProject response:", res);
    return res;
  },

  /**
   * getConfig retrieves the loaded provar configuration.
   */
  async getConfig(): Promise<{ config: ProvarConfig | null }> {
    debug("[RPC Client] getConfig request");
    const res = await electroview.rpc!.request.getConfig({});
    debugRedacted("[RPC Client] getConfig response:", res);
    return res;
  },

  /**
   * saveConfig updates the loaded provar configuration.
   */
  async saveConfig(config: ProvarConfig): Promise<{ success: boolean }> {
    debugRedacted("[RPC Client] saveConfig request:", { config });
    const res = await electroview.rpc!.request.saveConfig({ config });
    debug("[RPC Client] saveConfig response:", res);
    return res;
  },

  /**
   * listFiles scans the project to list all test yml files.
   */
  async listFiles(): Promise<{ tests: string[] }> {
    debug("[RPC Client] listFiles request");
    const res = await electroview.rpc!.request.listFiles({});
    debug("[RPC Client] listFiles response:", res);
    return res;
  },

  /**
   * readFile loads and parses the test file graph.
   */
  async readFile(path: string): Promise<{ content: TestFile }> {
    debug("[RPC Client] readFile request:", path);
    const res = await electroview.rpc!.request.readFile({ path });
    debug("[RPC Client] readFile response success:", !!res.content);
    return res;
  },

  /**
   * writeFile writes the updated test file graph to disk.
   */
  async writeFile(
    path: string,
    content: TestFile,
  ): Promise<{ success: boolean }> {
    debug("[RPC Client] writeFile request:", path);
    const res = await electroview.rpc!.request.writeFile({ path, content });
    debug("[RPC Client] writeFile response:", res);
    return res;
  },

  /**
   * createFile creates a new test graph definition.
   */
  async createFile(path: string, name: string): Promise<{ success: boolean }> {
    debug("[RPC Client] createFile request:", path, name);
    const res = await electroview.rpc!.request.createFile({ path, name });
    debug("[RPC Client] createFile response:", res);
    return res;
  },

  /**
   * createDirectory creates a new directory in the project.
   */
  async createDirectory(path: string): Promise<{ success: boolean }> {
    debug("[RPC Client] createDirectory request:", path);
    const res = await electroview.rpc!.request.createDirectory({ path });
    debug("[RPC Client] createDirectory response:", res);
    return res;
  },

  /**
   * deletePath removes a file or directory from the project.
   */
  async deletePath(path: string): Promise<{ success: boolean }> {
    debug("[RPC Client] deletePath request:", path);
    const res = await electroview.rpc!.request.deletePath({ path });
    debug("[RPC Client] deletePath response:", res);
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
    debug(
      "[RPC Client] assistEditor Stream request:",
      path,
      "history length:",
      history?.length,
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
    debug("[RPC Client] compileTest Stream request:", path);
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
    debug(
      "[RPC Client] runTestPath Stream request:",
      path,
      "pathIndex:",
      pathIndex,
      "upToTaskId:",
      upToTaskId,
      "headless:",
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
    debug(
      "[RPC Client] acceptVisualState request:",
      testPath,
      "pathIndex:",
      pathIndex,
      "taskId:",
      taskId,
    );
    const res = await electroview.rpc!.request.acceptVisualState({
      testPath,
      pathIndex,
      taskId,
    });
    debug("[RPC Client] acceptVisualState response:", res);
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
    debug(
      "[RPC Client] getScreenshots request:",
      testPath,
      "pathIndex:",
      pathIndex,
      "taskId:",
      taskId,
    );
    const res = await electroview.rpc!.request.getScreenshots({
      testPath,
      pathIndex,
      taskId,
    });
    debug("[RPC Client] getScreenshots response (keys):", Object.keys(res));
    return res;
  },

  /**
   * getNodeGeneratedCode returns the source text of the compiled execute
   * function for a single task, extracted from the .test.ts file the
   * compiler produced. `upToDate` is true only when the compiled file
   * exists and its hash matches the current YAML; otherwise the caller
   * should prompt the user to recompile before showing the code.
   */
  async getNodeGeneratedCode(
    testPath: string,
    taskId: string,
  ): Promise<{ code: string | null; upToDate: boolean }> {
    debug(
      "[RPC Client] getNodeGeneratedCode request:",
      testPath,
      "taskId:",
      taskId,
    );
    const res = await electroview.rpc!.request.getNodeGeneratedCode({
      testPath,
      taskId,
    });
    debug(
      "[RPC Client] getNodeGeneratedCode response upToDate:",
      res.upToDate,
      "hasCode:",
      res.code !== null,
    );
    return res;
  },

  /**
   * createSampleProject prompts the user for a destination folder, clones the upstream
   * demo-social sample into it, and opens it as the active project. Returns the new project
   * path on success.
   */
  async createSampleProject(): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    debug("[RPC Client] createSampleProject request");
    const res = await electroview.rpc!.request.createSampleProject({});
    debug("[RPC Client] createSampleProject response:", res);
    return res;
  },

  /**
   * openExternal asks the Bun host process to open the given URL in the user's default
   * browser. Used for external links (e.g. provar.se/guide) so the in-app overlay click
   * handlers can't swallow the navigation intent.
   */
  async openExternal(url: string): Promise<{ success: boolean }> {
    debug("[RPC Client] openExternal request:", url);
    const res = await electroview.rpc!.request.openExternal({ url });
    debug("[RPC Client] openExternal response:", res);
    return res;
  },

  /**
   * cancelRun stops an in-flight test run by runId. Called from the
   * editor toolbar's Stop button. Returns `{ success: false }` when no
   * active runner matches (race with natural completion).
   */
  async cancelRun(runId: string): Promise<{ success: boolean }> {
    console.log("[RPC Client] cancelRun request:", runId);
    const res = await electroview.rpc!.request.cancelRun({ runId });
    console.log("[RPC Client] cancelRun response:", res);
    return res;
  },
};
