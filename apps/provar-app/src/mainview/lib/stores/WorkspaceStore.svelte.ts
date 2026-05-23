import { ProvarAPI } from "../api/provar";
import { registerRPCHandlers } from "../api/rpc";
import type { ProvarConfig } from "../../../shared/domain";

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

  async initialize() {
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

  async refreshFiles() {
    if (!this.path) return;
    const res = await ProvarAPI.listFiles();
    this.tests = res.tests;
  }

  async saveConfig(newConfig: ProvarConfig) {
    const res = await ProvarAPI.saveConfig(newConfig);
    if (res.success) {
      this.config = newConfig;
      this.isConfigModalOpen = false;
      await this.refreshFiles();
    }
    return res.success;
  }
}

export const workspaceStore = new WorkspaceStore();
