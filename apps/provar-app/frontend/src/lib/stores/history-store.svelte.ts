import { History } from '../api';

/**
 * HistoryStore owns the desktop app's recent-projects list. Persists
 * via the History binding to ~/.provar/history.yml — separate from
 * the user's settings.
 */
class HistoryStore {
  recent = $state<string[]>([]);
  loaded = $state(false);

  /**
   * load reads the on-disk history into the store. Idempotent. A
   * missing file is not an error — the app must boot cleanly on a
   * fresh machine.
   */
  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      this.recent = await History.Recent();
    } catch (err) {
      console.error('HistoryStore: load failed:', err);
      this.recent = [];
    }
  }

  /**
   * add prepends path optimistically, then persists. On error, reverts
   * to the prior list and re-throws so callers can show a toast.
   */
  async add(path: string): Promise<void> {
    const prior = this.recent;
    this.recent = [path, ...prior.filter((p) => p !== path)].slice(0, 10);
    try {
      await History.Add(path);
    } catch (err) {
      this.recent = prior;
      throw err;
    }
  }
}

export const historyStore = new HistoryStore();