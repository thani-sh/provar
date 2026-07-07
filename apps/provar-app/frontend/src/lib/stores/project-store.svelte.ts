import { File, Config, Project } from '../api';
import { historyStore } from './history-store.svelte';

/**
 * ProjectStore owns the path, config, and test-file list of the active
 * project. Recent-projects persistence lives in historyStore.
 */
class ProjectStore {
  path = $state<string | null>(null);
  config = $state<Record<string, unknown> | null>(null);
  tests = $state<string[]>([]);

  setPath(path: string | null) {
    this.path = path;
    if (path === null) {
      this.tests = [];
      this.config = null;
    }
  }

  async refreshTests() {
    if (!this.path) {
      this.tests = [];
      return;
    }
    try {
      this.tests = await File.ListTests(this.path);
    } catch (e) {
      console.error('ProjectStore: ListTests failed:', e);
      this.tests = [];
    }
  }

  async openProject(path: string) {
    this.setPath(path);
    await this.refreshTests();
    try {
      await historyStore.add(path);
    } catch (e) {
      // historyStore.add already reverts in-memory state on failure;
      // log here so the failure is visible.
      console.error('ProjectStore: history add failed:', e);
    }
  }

  async loadConfig() {
    if (!this.path) return;
    try {
      this.config = await Config.LoadConfig(this.path);
    } catch (e) {
      console.error('ProjectStore: LoadConfig failed:', e);
      this.config = null;
    }
  }

  async saveConfig(next: Record<string, unknown>) {
    if (!this.path) return;
    try {
      await Config.SaveConfig(this.path, next);
      this.config = next;
    } catch (e) {
      console.error('ProjectStore: SaveConfig failed:', e);
    }
  }
}

export const projectStore = new ProjectStore();