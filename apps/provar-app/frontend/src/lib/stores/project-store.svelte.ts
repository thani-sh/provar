import type { ProvarConfig } from '../types';

/**
 * ProjectStore owns the path, config, and test-file list of the active
 * project. Bindings to the Go side (Phase 3) plug in here — the shape
 * of the store is what the components read from, regardless of where
 * the data comes from.
 */
class ProjectStore {
  path = $state<string | null>(null);
  config = $state<ProvarConfig | null>(null);
  tests = $state<string[]>([]);

  setPath(path: string | null) {
    this.path = path;
    if (path === null) {
      this.tests = [];
      this.config = null;
    }
  }

  setTests(tests: string[]) {
    this.tests = tests;
  }

  saveConfig(next: ProvarConfig) {
    this.config = next;
  }
}

export const projectStore = new ProjectStore();