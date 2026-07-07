import { History, Project } from '../api';

/**
 * SettingsStore owns app-lifecycle state from the on-disk settings file:
 * the user's home directory and the first-launch flag that controls
 * whether the setup wizard should be shown.
 *
 * The recent-projects list lives in HistoryStore, not here.
 */
class SettingsStore {
  homeDir = $state('');
  showSetupWizard = $state(false);
  hasCheckedSetup = $state(false);

  /** load reads the on-disk home dir and history existence. Idempotent. */
  async load() {
    if (this.hasCheckedSetup) return;
    this.hasCheckedSetup = true;
    try {
      this.homeDir = await Project.Home();
    } catch (err) {
      console.error('SettingsStore: home lookup failed:', err);
    }
    // The wizard is shown exactly when the user has never launched the
    // app before. History.Exists is the right signal — a missing file
    // means "first launch"; an empty (or populated) file means "not
    // first launch", and we don't flicker on/off as the user clears
    // their recent list.
    try {
      const exists = await History.Exists();
      this.showSetupWizard = !exists;
    } catch (err) {
      console.error('SettingsStore: history check failed:', err);
    }
  }

  dismissSetupWizard() {
    this.showSetupWizard = false;
  }
}

export const settingsStore = new SettingsStore();