import { ProvarAPI } from "../api/provar";
import { registerRPCHandlers } from "../api/rpc";
import type { ProvarConfig } from "@libs/domain/zod";

/**
 * ProjectStore manages the path, config, and file list of the current active test project.
 */
class ProjectStore {
  path = $state<string | null>(null);
  config = $state<ProvarConfig | null>(null);
  tests = $state<string[]>([]);
  isConfigModalOpen = $state(false);

  constructor() {
    registerRPCHandlers({
      projectOpened: (path) => {
        this.path = path;
        this.initialize();
      },
      projectChanged: () => {
        this.refreshFiles();
      },
    });
  }

  /**
   * initialize retrieves the project path and configurations from the backend.
   */
  async initialize(): Promise<void> {
    try {
      const projectRes = await ProvarAPI.getProject();
      const configRes = await ProvarAPI.getConfig();

      this.path = projectRes.path || null;

      if (configRes.config) {
        this.config = configRes.config;
        await this.refreshFiles();
      } else if (this.path) {
        this.isConfigModalOpen = true;
      }
    } catch (e) {
      console.error("ProjectStore: Initialization failed:", e);
      if (this.path) {
        this.isConfigModalOpen = true;
      }
    }
  }

  /**
   * refreshFiles fetches the list of available test files in the project.
   */
  async refreshFiles(): Promise<void> {
    if (!this.path) return;
    const res = await ProvarAPI.listFiles();
    this.tests = res.tests;
  }

  /**
   * saveConfig stores the updated project variables and config on disk.
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
 * projectStore is the shared reactive state instance of ProjectStore.
 */
export const projectStore = new ProjectStore();
