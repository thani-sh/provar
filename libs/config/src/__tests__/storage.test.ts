import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { __test__ } from "../storage";
import {
  modelSettingsSchema,
  settingsSchema,
  assertProviderConfigured,
  getActiveProviderRequirements,
  ProviderConfigError,
} from "../schema";

const { buildStorage, deepMerge } = __test__;

describe("settingsSchema defaults", () => {
  test("produces a fully-populated Settings when parsed from {}", () => {
    const parsed = settingsSchema.parse({});
    expect(parsed.recentProjects).toEqual([]);
    expect(parsed.models.defaultProvider).toBe("google-generative-ai");
    expect(parsed.models.providers.openai).toEqual({
      apiKey: "",
      model: "gpt-4o",
      baseUrl: "",
    });
    expect(parsed.models.providers["google-generative-ai"]).toEqual({
      apiKey: "",
      model: "gemini-1.5-flash",
    });
    expect(parsed.models.providers.minimax).toEqual({
      apiKey: "",
      model: "MiniMax-M3",
      baseUrl: "https://api.MiniMax.io/anthropic",
    });
  });

  test("modelSettingsSchema defaults to google-generative-ai provider", () => {
    const parsed = modelSettingsSchema.parse({});
    expect(parsed.defaultProvider).toBe("google-generative-ai");
  });

  test("provider selection accepts only the three known providers", () => {
    const okOpenAI = modelSettingsSchema.safeParse({
      defaultProvider: "openai",
    });
    expect(okOpenAI.success).toBe(true);
    const okMiniMax = modelSettingsSchema.safeParse({
      defaultProvider: "minimax",
    });
    expect(okMiniMax.success).toBe(true);
    const bad = modelSettingsSchema.safeParse({
      defaultProvider: "anthropic",
    });
    expect(bad.success).toBe(false);
  });

  test("minimax provider defaults to MiniMax-M3 and the public Anthropic-compatible base URL", () => {
    const parsed = modelSettingsSchema.parse({});
    expect(parsed.providers.minimax).toEqual({
      apiKey: "",
      model: "MiniMax-M3",
      baseUrl: "https://api.MiniMax.io/anthropic",
    });
  });
});

describe("provider configuration gate", () => {
  test("reports no requirements when every provider has a key", () => {
    const settings = modelSettingsSchema.parse({});
    settings.providers.openai.apiKey = "sk";
    settings.providers["google-generative-ai"].apiKey = "AIza";
    settings.providers.minimax.apiKey = "eyJ";
    for (const provider of [
      "openai",
      "google-generative-ai",
      "minimax",
    ] as const) {
      settings.defaultProvider = provider;
      expect(getActiveProviderRequirements(settings)).toEqual([]);
    }
  });

  test("flags a missing apiKey on the active provider", () => {
    const settings = modelSettingsSchema.parse({});
    // Default defaultProvider is google-generative-ai, which has apiKey: "".
    const reqs = getActiveProviderRequirements(settings);
    expect(reqs).toHaveLength(1);
    const first = reqs[0]!;
    expect(first.field).toBe("apiKey");
    expect(first.message).toContain("google-generative-ai");
  });

  test("flags a whitespace-only apiKey as missing", () => {
    const settings = modelSettingsSchema.parse({});
    settings.defaultProvider = "minimax";
    settings.providers.minimax.apiKey = "   ";
    const reqs = getActiveProviderRequirements(settings);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.field).toBe("apiKey");
  });

  test("assertProviderConfigured throws ProviderConfigError with the active provider name", () => {
    const settings = modelSettingsSchema.parse({});
    settings.defaultProvider = "minimax";
    settings.providers.minimax.apiKey = "";
    expect(() => assertProviderConfigured(settings)).toThrow(
      ProviderConfigError,
    );
    try {
      assertProviderConfigured(settings);
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderConfigError);
      const e = err as ProviderConfigError;
      expect(e.provider).toBe("minimax");
      expect(e.requirements[0]!.message).toContain("minimax");
    }
  });

  test("assertProviderConfigured is a no-op when the active provider has a key", () => {
    const settings = modelSettingsSchema.parse({});
    settings.providers["google-generative-ai"].apiKey = "AIza";
    expect(() => assertProviderConfigured(settings)).not.toThrow();
  });
});

describe("deepMerge contract (BUG-5)", () => {
  test("undefined keys in the patch are ignored (leave base alone)", () => {
    const merged = deepMerge(
      { a: 1, b: 2 },
      { a: undefined as unknown as number },
    );
    expect(merged).toEqual({ a: 1, b: 2 });
  });

  test("nested plain objects are deep-merged key-by-key", () => {
    const merged = deepMerge(
      {
        models: {
          providers: { openai: { apiKey: "sk", model: "gpt-4o", baseUrl: "" } },
        },
      },
      { models: { defaultProvider: "openai" } },
    );
    expect(merged).toEqual({
      models: {
        defaultProvider: "openai",
        providers: { openai: { apiKey: "sk", model: "gpt-4o", baseUrl: "" } },
      },
    });
  });

  test("arrays in the patch replace the base array wholesale", () => {
    const merged = deepMerge({ list: [1, 2, 3] }, { list: [9] });
    expect(merged.list).toEqual([9]);
  });

  test("plain objects in the patch replace non-object base values", () => {
    const merged = deepMerge({ a: "string" }, { a: { nested: true } });
    expect(merged.a).toEqual({ nested: true });
  });

  test("non-plain objects (class instances, arrays) in the patch replace", () => {
    class Foo {
      x = 1;
    }
    const inst = new Foo();
    const merged = deepMerge({}, { a: inst });
    expect(merged.a).toBe(inst);
  });

  test("null is treated as a value (replaces, does not skip)", () => {
    const merged = deepMerge({ a: "keep" }, { a: null as unknown as string });
    expect(merged.a).toBeNull();
  });

  test("isPlainObject rejects arrays and class instances", () => {
    expect(deepMerge({}, { a: [1, 2] }).a).toEqual([1, 2]);
    class Bar {
      x = 1;
    }
    const b = new Bar();
    const out = deepMerge({}, { a: b });
    expect(out.a).toBe(b);
  });
});

describe("buildStorage round-trip (BUG-5 + BUG-6)", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "provar-settings-"));
    filePath = path.join(tmpDir, "settings.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("loadSettings returns full defaults when no file exists", () => {
    const { loadSettings } = buildStorage(tmpDir, filePath);
    const loaded = loadSettings();
    expect(loaded.recentProjects).toEqual([]);
    expect(loaded.models.defaultProvider).toBe("google-generative-ai");
  });

  test("loadSettings swallows JSON parse errors and returns defaults", () => {
    fs.writeFileSync(filePath, "{ not valid json");
    const { loadSettings } = buildStorage(tmpDir, filePath);
    const loaded = loadSettings();
    expect(loaded.recentProjects).toEqual([]);
  });

  test("saveSettings seeds full defaults when file is empty/missing", () => {
    const { saveSettings } = buildStorage(tmpDir, filePath);
    const saved = saveSettings({});
    expect(saved.recentProjects).toEqual([]);
    expect(fs.existsSync(filePath)).toBe(true);
    // And it's valid JSON.
    const onDisk = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(onDisk.models.providers.openai.model).toBe("gpt-4o");
  });

  test("saveSettings deep-merges nested providers (BUG-5: partial saves do not drop siblings)", () => {
    // Pre-seed an existing settings file with openai credentials.
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        models: {
          providers: {
            openai: {
              apiKey: "sk-existing",
              model: "gpt-4o",
              baseUrl: "https://api.openai.com",
            },
          },
        },
      }),
    );
    const { saveSettings } = buildStorage(tmpDir, filePath);
    // Patch only flips defaultProvider; openai creds must survive.
    // (Cast to Partial<Settings> because TS can't see that the saved
    // shape is fully populated after defaults are applied.)
    const merged = saveSettings({
      models: { defaultProvider: "openai" },
    } as unknown as Parameters<typeof saveSettings>[0]);
    expect(merged.models.defaultProvider).toBe("openai");
    expect(merged.models.providers.openai.apiKey).toBe("sk-existing");
    expect(merged.models.providers.openai.baseUrl).toBe(
      "https://api.openai.com",
    );
  });

  test("saveSettings replaces arrays wholesale (not deep-merge)", () => {
    fs.writeFileSync(filePath, JSON.stringify({ recentProjects: ["a", "b"] }));
    const { saveSettings } = buildStorage(tmpDir, filePath);
    const merged = saveSettings({ recentProjects: ["c"] });
    expect(merged.recentProjects).toEqual(["c"]);
  });

  test("saveSettings treats undefined in the patch as a no-op", () => {
    fs.writeFileSync(filePath, JSON.stringify({ recentProjects: ["a"] }));
    const { saveSettings } = buildStorage(tmpDir, filePath);
    const merged = saveSettings({
      recentProjects: undefined as unknown as string[],
    });
    expect(merged.recentProjects).toEqual(["a"]);
  });

  test("saveSettings leaves existing nested values alone when patch omits them", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        models: {
          providers: {
            openai: {
              apiKey: "sk",
              model: "gpt-4o-mini",
              baseUrl: "https://api.openai.com",
            },
          },
        },
      }),
    );
    const { saveSettings } = buildStorage(tmpDir, filePath);
    // Touches only defaultProvider — every other key must survive.
    const merged = saveSettings({
      models: { defaultProvider: "openai" },
    } as unknown as Parameters<typeof saveSettings>[0]);
    expect(merged.models.providers.openai.model).toBe("gpt-4o-mini");
  });

  test("ensureSettings creates the file with defaults if missing", () => {
    expect(fs.existsSync(filePath)).toBe(false);
    const { ensureSettings } = buildStorage(tmpDir, filePath);
    const ensured = ensureSettings();
    expect(ensured.recentProjects).toEqual([]);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test("ensureSettings reads back existing settings without rewriting them verbatim", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({ recentProjects: ["preexisting"] }),
    );
    const { ensureSettings } = buildStorage(tmpDir, filePath);
    const ensured = ensureSettings();
    expect(ensured.recentProjects).toEqual(["preexisting"]);
  });

  test("saveSettings writes pretty-printed JSON (human-readable on disk)", () => {
    const { saveSettings } = buildStorage(tmpDir, filePath);
    saveSettings({ recentProjects: ["fmt-test"] });
    const onDisk = fs.readFileSync(filePath, "utf-8");
    expect(onDisk).toContain("\n  "); // indentation
    expect(onDisk).toContain('"recentProjects": [');
  });

  test("settingsExists returns false when no file is on disk", () => {
    const { settingsExists } = buildStorage(tmpDir, filePath);
    expect(settingsExists()).toBe(false);
  });

  test("settingsExists returns true once a file has been created", () => {
    const { saveSettings, settingsExists } = buildStorage(tmpDir, filePath);
    expect(settingsExists()).toBe(false);
    saveSettings({});
    expect(settingsExists()).toBe(true);
  });
});
