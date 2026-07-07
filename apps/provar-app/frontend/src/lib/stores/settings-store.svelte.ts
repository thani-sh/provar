import { Project } from '../api';

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

  /** load reads the on-disk home dir and validates settings. Idempotent. */
  async load() {
    if (this.hasCheckedSetup) return;
    this.hasCheckedSetup = true;
    try {
      this.homeDir = await Project.Home();
    } catch (err) {
      console.error('SettingsStore: home lookup failed:', err);
    }
    // The wizard is shown exactly when settings are unusable: the file
    // is missing, or it loads but is incomplete (e.g. the active
    // provider has no API key). The check is settings-driven, not
    // history-driven — a user can have settings without ever having
    // launched the GUI (CLI write, hand edit, fresh install that used
    // the sample), and we shouldn't pester them in that case.
    try {
      const err = await Project.ValidateSettings();
      this.showSetupWizard = err !== null;
    } catch (err) {
      console.error('SettingsStore: settings validation failed:', err);
      this.showSetupWizard = true;
    }
  }

  dismissSetupWizard() {
    this.showSetupWizard = false;
  }
}

export const settingsStore = new SettingsStore();