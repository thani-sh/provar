import { homedir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { settingsSchema, type Settings } from "./schema";

// Settings are stored at ~/.provar/settings.json
const SETTINGS_DIR = join(homedir(), ".provar");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");

/**
 * isPlainObject reports whether a value is a plain JSON-serialisable object
 * (not an array, not null, not a class instance). Used by deepMerge to
 * decide which values to recurse into.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * deepMerge recursively merges `patch` into `base`. Plain objects at any
 * depth are merged key-by-key; arrays, primitives, and `undefined` values
 * in `patch` replace the base value. `undefined` is treated as "leave the
 * base value alone" so callers can pass partial nested objects without
 * having to enumerate every sibling key (see BUG-5).
 */
function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, patchVal] of Object.entries(patch)) {
    if (patchVal === undefined) continue;
    const baseVal = out[key];
    if (isPlainObject(patchVal) && isPlainObject(baseVal)) {
      out[key] = deepMerge(baseVal, patchVal);
    } else {
      out[key] = patchVal;
    }
  }
  return out;
}

/**
 * loadSettings reads and validates settings from disk, returning in-memory
 * defaults when no file exists. Reads must not write — see BUG-6.
 */
export function loadSettings(): Settings {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      return settingsSchema.parse({});
    }
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    return settingsSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error("[settings] Failed to load settings:", error);
    return settingsSchema.parse({});
  }
}

/**
 * ensureSettings is the explicit counterpart to the previous implicit
 * "load-time initialization" behavior. Call it once at application start
 * (or never, if you don't need the file to exist on disk yet) to create
 * the on-disk file with current defaults.
 */
export function ensureSettings(): Settings {
  if (existsSync(SETTINGS_PATH)) {
    return loadSettings();
  }
  return saveSettings(settingsSchema.parse({}));
}

/**
 * saveSettings merges the provided partial settings with current values
 * and writes to disk.
 *
 * Merge contract (see BUG-5):
 * - Top-level keys are merged.
 * - Nested plain objects (e.g. `models.providers.openai`) are deep-merged,
 *   so saving `{ models: { defaultProvider: "openai" } }` does NOT drop
 *   existing provider credentials.
 * - Arrays and primitives are replaced wholesale when present in the patch.
 * - `undefined` keys in the patch are ignored (use `null` to clear).
 */
export function saveSettings(settings: Partial<Settings>): Settings {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true });

    let current: Record<string, unknown> = {};
    if (existsSync(SETTINGS_PATH)) {
      try {
        current = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
      } catch {
        // ignore malformed file — start fresh
      }
    }

    const merged = settingsSchema.parse(
      deepMerge(current, settings as Record<string, unknown>),
    );
    writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  } catch (error) {
    console.error("[settings] Failed to save settings:", error);
    throw error;
  }
}
