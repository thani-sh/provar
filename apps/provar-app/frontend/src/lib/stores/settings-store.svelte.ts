/**
 * SettingsStore owns app-lifecycle state from the on-disk settings file:
 * recent projects, the user's home directory, and the first-launch flag
 * that controls whether the setup wizard should be shown.
 *
 * Data source (Phase 3): `App.GetSettings()` from the Go side. Until that
 * lands, the store carries empty defaults.
 */
class SettingsStore {
  recentProjects = $state<string[]>([]);
  homeDir = $state('');
  showSetupWizard = $state(false);
  hasCheckedSetup = $state(false);

  setSettings(next: { recentProjects?: string[]; homeDir?: string; showSetupWizard?: boolean }) {
    this.recentProjects = next.recentProjects ?? [];
    this.homeDir = next.homeDir ?? '';
    this.showSetupWizard = next.showSetupWizard ?? false;
    this.hasCheckedSetup = true;
  }

  dismissSetupWizard() {
    this.showSetupWizard = false;
  }
}

export const settingsStore = new SettingsStore();