import { homedir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { settingsSchema, type Settings } from "./schema";

// Settings are stored at ~/.provar/settings.json
const SETTINGS_DIR = join(homedir(), ".provar");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");

/**
 * loadSettings reads and validates settings from disk, returning defaults on failure.
 */
export function loadSettings(): Settings {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      const defaults = settingsSchema.parse({});
      saveSettings(defaults);
      return defaults;
    }
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    return settingsSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error("[settings] Failed to load settings:", error);
    return settingsSchema.parse({});
  }
}

/**
 * saveSettings merges the provided partial settings with current values and writes to disk.
 */
export function saveSettings(settings: Partial<Settings>): Settings {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true });

    let current: unknown = {};
    if (existsSync(SETTINGS_PATH)) {
      try {
        current = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
      } catch {
        // ignore malformed file — start fresh
      }
    }

    const merged = settingsSchema.parse({ ...(current as object), ...settings });
    writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  } catch (error) {
    console.error("[settings] Failed to save settings:", error);
    throw error;
  }
}
