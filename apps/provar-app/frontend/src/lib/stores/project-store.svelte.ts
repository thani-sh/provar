import { Project, File, Config } from '../api';

/**
 * ProjectStore owns the path, config, and test-file list of the active
 * project. Bindings to the Go side (Phase 3) plug in here — the shape
 * of the store is what the components read from, regardless of where
 * the data comes from.
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
      await Project.AddRecent(path);
    } catch (e) {
      console.warn('ProjectStore: AddRecent failed:', e);
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