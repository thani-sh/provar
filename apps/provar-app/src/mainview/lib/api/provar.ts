import { electroview } from "./rpc";
import type { ProvarConfig, TestFile } from "../../../shared/domain";

export const ProvarAPI = {
  async getWorkspace() {
    console.log("[RPC Client] getWorkspace request");
    const res = await electroview.rpc!.request.getWorkspace({});
    console.log("[RPC Client] getWorkspace response:", res);
    return res;
  },

  async getConfig() {
    console.log("[RPC Client] getConfig request");
    const res = await electroview.rpc!.request.getConfig({});
    console.log("[RPC Client] getConfig response:", res);
    return res;
  },

  async saveConfig(config: ProvarConfig) {
    console.log("[RPC Client] saveConfig request:", config);
    const res = await electroview.rpc!.request.saveConfig({ config });
    console.log("[RPC Client] saveConfig response:", res);
    return res;
  },

  async listFiles() {
    console.log("[RPC Client] listFiles request");
    const res = await electroview.rpc!.request.listFiles({});
    console.log("[RPC Client] listFiles response:", res);
    return res;
  },

  async readFile(path: string) {
    console.log("[RPC Client] readFile request:", path);
    const res = await electroview.rpc!.request.readFile({ path });
    console.log("[RPC Client] readFile response:", res);
    return res;
  },

  async writeFile(path: string, content: TestFile) {
    console.log("[RPC Client] writeFile request:", path);
    const res = await electroview.rpc!.request.writeFile({ path, content });
    console.log("[RPC Client] writeFile response:", res);
    return res;
  },

  async createFile(path: string, name: string) {
    console.log("[RPC Client] createFile request:", path, name);
    const res = await electroview.rpc!.request.createFile({ path, name });
    console.log("[RPC Client] createFile response:", res);
    return res;
  },

  async createDirectory(path: string) {
    console.log("[RPC Client] createDirectory request:", path);
    const res = await electroview.rpc!.request.createDirectory({ path });
    console.log("[RPC Client] createDirectory response:", res);
    return res;
  },

  async deletePath(path: string) {
    console.log("[RPC Client] deletePath request:", path);
    const res = await electroview.rpc!.request.deletePath({ path });
    console.log("[RPC Client] deletePath response:", res);
    return res;
  },

  async assistEditor(prompt: string, path?: string) {
    console.log("[RPC Client] assistEditor request:", prompt, path);
    const res = await electroview.rpc!.request.assistEditor({ prompt, path });
    console.log("[RPC Client] assistEditor response:", res);
    return res;
  },
  
  async compileTest(path: string) {
    console.log("[RPC Client] compileTest request:", path);
    const res = await electroview.rpc!.request.compileTest({ path });
    console.log("[RPC Client] compileTest response:", res);
    return res;
  },
  
  async runTestPath(path: string, pathIndex: number, upToActionId?: string, headless?: boolean) {
    console.log("[RPC Client] runTestPath request:", path, pathIndex, upToActionId, headless);
    const res = await electroview.rpc!.request.runTestPath({ path, pathIndex, upToActionId, headless });
    console.log("[RPC Client] runTestPath response:", res);
    return res;
  },
  
  async acceptVisualState(testPath: string, pathIndex: number, actionId: string) {
    console.log("[RPC Client] acceptVisualState request:", testPath, pathIndex, actionId);
    const res = await electroview.rpc!.request.acceptVisualState({ testPath, pathIndex, actionId });
    console.log("[RPC Client] acceptVisualState response:", res);
    return res;
  },
  
  async getScreenshots(testPath: string, pathIndex: number, actionId: string) {
    console.log("[RPC Client] getScreenshots request:", testPath, pathIndex, actionId);
    const res = await electroview.rpc!.request.getScreenshots({ testPath, pathIndex, actionId });
    console.log("[RPC Client] getScreenshots response (keys):", Object.keys(res));
    return res;
  },
};
