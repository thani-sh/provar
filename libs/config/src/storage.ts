import { homedir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from "fs";
import { settingsSchema, type Settings } from "./schema";

// Settings are stored at ~/.provar/settings.json
const SETTINGS_DIR = join(homedir(), ".provar");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");

export class SettingsLoadError extends Error {
  readonly cause: unknown;
  readonly backupPath?: string;

  constructor(message: string, cause: unknown, backupPath?: string) {
    super(message);
    this.name = "SettingsLoadError";
    this.cause = cause;
    this.backupPath = backupPath;
  }
}

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
 * buildStorage returns a load/save/ensure triplet bound to a given directory
 * and file path. The exported `loadSettings` / `saveSettings` / `ensureSettings`
 * below are simply this builder wired to the default `~/.provar` location.
 *
 * Exposed (under a `__test__` namespace) so unit tests can exercise the
 * round-trip against a tmp dir without touching the user's real homedir.
 */
function buildStorage(dir: string, filePath: string) {
  function settingsExists(): boolean {
    return existsSync(filePath);
  }

  function loadSettings(): Settings {
    if (!existsSync(filePath)) {
      return settingsSchema.parse({});
    }

    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch (readError) {
      throw new SettingsLoadError(
        `Failed to read settings file: ${(readError as Error).message}`,
        readError
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (parseError) {
      const backupPath = `${filePath}.bak.${new Date().toISOString()}`;
      try {
        renameSync(filePath, backupPath);
      } catch (renameError) {
        console.error("[settings] Failed to rename corrupt settings file:", renameError);
      }
      throw new SettingsLoadError(
        `Failed to parse settings JSON: ${(parseError as Error).message}`,
        parseError,
        backupPath
      );
    }

    try {
      return settingsSchema.parse(parsedJson);
    } catch (validationError) {
      throw new SettingsLoadError(
        `Failed to validate settings: ${(validationError as Error).message}`,
        validationError
      );
    }
  }

  function ensureSettings(): Settings {
    if (existsSync(filePath)) {
      return loadSettings();
    }
    return saveSettings(settingsSchema.parse({}));
  }

  function saveSettings(settings: Partial<Settings>): Settings {
    try {
      mkdirSync(dir, { recursive: true });

      let current: Record<string, unknown> = {};
      if (existsSync(filePath)) {
        try {
          current = JSON.parse(readFileSync(filePath, "utf-8"));
        } catch {
          // ignore malformed file — start fresh
        }
      }

      const merged = settingsSchema.parse(
        deepMerge(current, settings as Record<string, unknown>),
      );
      writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
      return merged;
    } catch (error) {
      console.error("[settings] Failed to save settings:", error);
      throw error;
    }
  }

  return { loadSettings, saveSettings, ensureSettings, settingsExists };
}

const defaultStorage = buildStorage(SETTINGS_DIR, SETTINGS_PATH);

/**
 * loadSettings reads and validates settings from disk, returning in-memory
 * defaults when no file exists. Reads must not write — see BUG-6.
 */
export const loadSettings = defaultStorage.loadSettings;

/**
 * ensureSettings is the explicit counterpart to the previous implicit
 * "load-time initialization" behavior. Call it once at application start
 * (or never, if you don't need the file to exist on disk yet) to create
 * the on-disk file with current defaults.
 */
export const ensureSettings = defaultStorage.ensureSettings;

/**
 * settingsExists reports whether the on-disk settings file is present.
 * Distinguishes "fresh install" (no file) from "user has configured something"
 * (file exists) without reading or parsing the file. The UI uses this to
 * decide whether to show the first-run setup wizard.
 */
export const settingsExists = defaultStorage.settingsExists;

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
export const saveSettings = defaultStorage.saveSettings;

/**
 * @internal
 * Test-only export — not part of the public API. Lets unit tests exercise
 * the full save/load round-trip against a tmp dir without writing to the
 * real `~/.provar/settings.json`.
 */
export const __test__ = {
  buildStorage,
  deepMerge,
};
