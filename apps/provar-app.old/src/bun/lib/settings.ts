// Settings logic has moved to @libs/config.
// This file re-exports from there so existing app imports continue to resolve.
export {
  loadSettings,
  saveSettings,
  ensureSettings,
  settingsExists,
  settingsSchema as SettingsSchema,
  type Settings,
} from "@libs/config";
