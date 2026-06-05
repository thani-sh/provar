import { z } from "zod";
import { Utils } from "electrobun/bun";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";

export const SettingsSchema = z.object({
  theme: z.enum(["light", "dark"]).default("dark"),
  placeholder: z.string().default("placeholder-value"),
});

export type Settings = z.infer<typeof SettingsSchema>;

const getSettingsPath = () => join(Utils.paths.userData, "settings.json");

export function loadSettings(): Settings {
  const settingsPath = getSettingsPath();
  try {
    if (!existsSync(settingsPath)) {
      const defaultSettings = SettingsSchema.parse({});
      saveSettings(defaultSettings);
      return defaultSettings;
    }
    const fileContent = readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(fileContent);
    return SettingsSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to load settings:", error);
    return SettingsSchema.parse({});
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const settingsPath = getSettingsPath();
  try {
    mkdirSync(Utils.paths.userData, { recursive: true });
    
    let currentSettings = {};
    if (existsSync(settingsPath)) {
      try {
        const fileContent = readFileSync(settingsPath, "utf-8");
        currentSettings = JSON.parse(fileContent);
      } catch (e) {
        // ignore
      }
    }
    
    const newSettings = SettingsSchema.parse({
      ...currentSettings,
      ...settings,
    });
    
    writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), "utf-8");
    return newSettings;
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  }
}
