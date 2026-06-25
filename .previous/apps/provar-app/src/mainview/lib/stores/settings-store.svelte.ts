import { ProvarAPI } from "../api/provar";
import { registerRPCHandlers } from "../api/rpc";
import { uiStore } from "./ui-store.svelte";

/**
 * SettingsStore owns app-lifecycle state that comes from the on-disk settings
 * file: the recent-projects list, the user's home directory, and the
 * first-launch flag that controls whether the setup wizard should be shown.
 *
 * It also registers the RPC handlers for `openSettings` and `settingsChanged`
 * so the rest of the app can stay decoupled from the IPC layer.
 */
class SettingsStore {
  recentProjects = $state<string[]>([]);
  homeDir = $state("");

  /**
   * Setup wizard state. We only ever want to *show* the wizard on the first
   * launch (no settings file on disk). After the user finishes or skips it,
   * we set this false for the rest of the session and never re-trigger it
   * from `settingsChanged` — the user actively opening the settings modal
   * shouldn't kick off a wizard.
   */
  showSetupWizard = $state(false);
  hasCheckedSetup = $state(false);

  constructor() {
    registerRPCHandlers({
      openSettings: () => {
        uiStore.isSettingsModalOpen = true;
      },
      settingsChanged: () => {
        this.reload();
      },
    });
  }

  /**
   * loadIfNeeded pulls the on-disk settings into the store. On the first call
   * (no project open yet) it also decides whether the setup wizard should be
   * shown. Idempotent — safe to call multiple times.
   */
  async loadIfNeeded(): Promise<void> {
    if (this.hasCheckedSetup) return;
    try {
      const res = await ProvarAPI.getSettings();
      this.recentProjects = res.settings.recentProjects || [];
      this.homeDir = res.home || "";
      if (res.settingsExists === false) {
        this.showSetupWizard = true;
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      this.hasCheckedSetup = true;
    }
  }

  /**
   * reload refreshes the recent-projects list and home dir, e.g. when the
   * settings file is mutated by the setup wizard or the settings modal.
   */
  async reload(): Promise<void> {
    try {
      const res = await ProvarAPI.getSettings();
      this.recentProjects = res.settings.recentProjects || [];
      this.homeDir = res.home || "";
    } catch (err) {
      console.error("Failed to reload settings:", err);
    }
  }

  /**
   * dismissSetupWizard hides the wizard and refreshes the recent-projects
   * list, since the wizard may have just written a new settings file.
   */
  async dismissSetupWizard(): Promise<void> {
    this.showSetupWizard = false;
    await this.reload();
  }
}

/**
 * settingsStore is the shared reactive state instance of SettingsStore.
 */
export const settingsStore = new SettingsStore();
