import { ProvarAPI } from "../api/provar";
import { registerRPCHandlers } from "../api/rpc";
import type { ProvarConfig } from "@libs/domain/zod";

/**
 * WorkspaceStore manages the path, config, and file list of the current active test workspace.
 */
class WorkspaceStore {
  path = $state<string | null>(null);
  config = $state<ProvarConfig | null>(null);
  tests = $state<string[]>([]);
  isConfigModalOpen = $state(false);

  constructor() {
    registerRPCHandlers({
      workspaceSelected: (path) => {
        this.path = path;
        this.initialize();
      },
      workspaceChanged: () => {
        this.refreshFiles();
      },
    });
  }

  /**
   * initialize retrieves the workspace path and configurations from the backend.
   */
  async initialize(): Promise<void> {
    try {
      const workspaceRes = await ProvarAPI.getWorkspace();
      const configRes = await ProvarAPI.getConfig();

      this.path = workspaceRes.path || null;

      if (configRes.config) {
        this.config = configRes.config;
        await this.refreshFiles();
      } else if (this.path) {
        this.isConfigModalOpen = true;
      }
    } catch (e) {
      console.error("WorkspaceStore: Initialization failed:", e);
      if (this.path) {
        this.isConfigModalOpen = true;
      }
    }
  }

  /**
   * refreshFiles fetches the list of available test files in the workspace.
   */
  async refreshFiles(): Promise<void> {
    if (!this.path) return;
    const res = await ProvarAPI.listFiles();
    this.tests = res.tests;
  }

  /**
   * saveConfig stores the updated workspace variables and config on disk.
   */
  async saveConfig(newConfig: ProvarConfig): Promise<boolean> {
    const res = await ProvarAPI.saveConfig(newConfig);
    if (res.success) {
      this.config = newConfig;
      this.isConfigModalOpen = false;
      await this.refreshFiles();
    }
    return res.success;
  }
}

/**
 * workspaceStore is the shared reactive state instance of WorkspaceStore.
 */
export const workspaceStore = new WorkspaceStore();
