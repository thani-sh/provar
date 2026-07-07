import { Project } from '../api';

/**
 * SettingsStore owns app-lifecycle state from the on-disk settings file:
 * recent projects, the user's home directory, and the first-launch flag
 * that controls whether the setup wizard should be shown.
 */
class SettingsStore {
  recentProjects = $state<string[]>([]);
  homeDir = $state('');
  showSetupWizard = $state(false);
  hasCheckedSetup = $state(false);

  /** load reads the on-disk settings into the store. Idempotent. */
  async load() {
    if (this.hasCheckedSetup) return;
    this.hasCheckedSetup = true;
    try {
      this.homeDir = await Project.Home();
      const recent = await Project.RecentProjects();
      this.recentProjects = recent ?? [];
      // settings.yml existence implies the user has run the app before.
      // For v1 we treat a populated recent list as the "not first launch"
      // signal. The real flag lands when setup-wizard writes a marker.
      this.showSetupWizard = (recent ?? []).length === 0 && this.recentProjects.length === 0;
    } catch (err) {
      console.error('SettingsStore: load failed:', err);
    }
  }

  dismissSetupWizard() {
    this.showSetupWizard = false;
  }

  /** prepend adds a path to the in-memory recent list. */
  prependRecent(path: string) {
    this.recentProjects = [
      path,
      ...this.recentProjects.filter((p) => p !== path),
    ].slice(0, 10);
  }
}

export const settingsStore = new SettingsStore();