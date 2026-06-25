import { z } from "zod";

// ---------------------------------------------------------------------------
// ModelSettings Schema
// ---------------------------------------------------------------------------

/**
 * openaiProviderSchema defines configuration for the OpenAI provider.
 */
const openaiProviderSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().default("gpt-4o"),
  baseUrl: z.string().default(""),
});

/**
 * googleProviderSchema defines configuration for the Google Generative AI provider.
 */
const googleProviderSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().default("gemini-1.5-flash"),
});

/**
 * minimaxProviderSchema defines configuration for the MiniMax provider.
 *
 * MiniMax exposes an Anthropic-compatible endpoint at
 * https://api.MiniMax.io/anthropic (see platform.MiniMax.io docs). The default
 * base URL points at that endpoint; users only need to provide an API key and
 * a model name (e.g. `MiniMax-M3`).
 */
const minimaxProviderSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().default("MiniMax-M3"),
  baseUrl: z.string().default("https://api.MiniMax.io/anthropic"),
});

/**
 * modelSettingsSchema defines the LLM provider selection and per-provider credentials.
 *
 * Defaults are supplied via factory functions so each `parse` call gets a
 * fresh, deep-cloned object. A literal `.default({...})` shares the same
 * nested object across all parses — a downstream mutation of one parsed
 * settings object would then poison every subsequent parse (caught by the
 * "provider configuration gate" tests).
 */
export const modelSettingsSchema = z.object({
  defaultProvider: z
    .enum(["openai", "google-generative-ai", "minimax"])
    .default("google-generative-ai"),
  providers: z
    .object({
      openai: openaiProviderSchema.default(() => ({
        apiKey: "",
        model: "gpt-4o",
        baseUrl: "",
      })),
      "google-generative-ai": googleProviderSchema.default(() => ({
        apiKey: "",
        model: "gemini-1.5-flash",
      })),
      minimax: minimaxProviderSchema.default(() => ({
        apiKey: "",
        model: "MiniMax-M3",
        baseUrl: "https://api.MiniMax.io/anthropic",
      })),
    })
    .default(() => ({
      openai: { apiKey: "", model: "gpt-4o", baseUrl: "" },
      "google-generative-ai": { apiKey: "", model: "gemini-1.5-flash" },
      minimax: {
        apiKey: "",
        model: "MiniMax-M3",
        baseUrl: "https://api.MiniMax.io/anthropic",
      },
    })),
});

/**
 * ModelSettings represents the structured settings configuration for all AI models.
 */
export type ModelSettings = z.infer<typeof modelSettingsSchema>;

// ---------------------------------------------------------------------------
// Active-provider validation
// ---------------------------------------------------------------------------

/**
 * Provider name union — kept in one place so the registry, the client, and
 * the UI can all import it without re-declaring the string list.
 */
export type ProviderName = "openai" | "google-generative-ai" | "minimax";

/**
 * ProviderRequirement describes a single missing-or-invalid field on the
 * active provider's configuration. Callers (CLI, desktop app) surface these
 * as a checklist for the user.
 */
export interface ProviderRequirement {
  field: "apiKey" | "model" | "baseUrl";
  message: string;
}

/**
 * getActiveProviderRequirements reports which fields are missing on the
 * currently-selected default provider's configuration. The compile pipeline
 * (CLI and desktop app) calls this before starting a session and refuses to
 * proceed if any requirement is unmet.
 *
 * Currently only the API key is required; model and base URL always have
 * defaults. We keep the shape generic so future providers (or a stricter
 * model check) can plug in without changing the call sites.
 */
export function getActiveProviderRequirements(
  settings: Pick<ModelSettings, "defaultProvider" | "providers">,
): ProviderRequirement[] {
  const cfg = settings.providers[settings.defaultProvider];
  if (!cfg) {
    return [
      {
        field: "apiKey",
        message: `No configuration found for default provider "${settings.defaultProvider}".`,
      },
    ];
  }
  const requirements: ProviderRequirement[] = [];
  if (!cfg.apiKey || cfg.apiKey.trim() === "") {
    requirements.push({
      field: "apiKey",
      message: `Default provider "${settings.defaultProvider}" has no API key configured. Add one in Settings to compile tests.`,
    });
  }
  return requirements;
}

/**
 * ProviderConfigError is thrown when the active provider's configuration is
 * incomplete and a compile/run cannot proceed. It carries the full
 * requirements list so callers can render a useful diagnostic instead of
 * letting the request fail deep inside the LLM client with an opaque auth
 * error.
 */
export class ProviderConfigError extends Error {
  readonly provider: ProviderName;
  readonly requirements: ProviderRequirement[];

  constructor(
    provider: ProviderName,
    requirements: ProviderRequirement[],
    message?: string,
  ) {
    super(
      message ??
        `AI provider "${provider}" is not configured: ${requirements
          .map((r) => r.message)
          .join(" ")}`,
    );
    this.name = "ProviderConfigError";
    this.provider = provider;
    this.requirements = requirements;
  }
}

/**
 * assertProviderConfigured throws a ProviderConfigError if the active provider
 * in `settings` is missing any required field. This is the gate every compile
 * / run call site uses before reaching the LLM client. Throwing (rather than
 * returning a boolean) makes the failure obvious at every call site without
 * requiring each caller to remember to check.
 */
export function assertProviderConfigured(
  settings: Pick<ModelSettings, "defaultProvider" | "providers">,
): void {
  const requirements = getActiveProviderRequirements(settings);
  if (requirements.length > 0) {
    throw new ProviderConfigError(settings.defaultProvider, requirements);
  }
}

// ---------------------------------------------------------------------------
// SettingsSchema
// ---------------------------------------------------------------------------

/**
 * settingsSchema is the full application settings schema stored on disk.
 */
export const settingsSchema = z.object({
  models: modelSettingsSchema.default(() => ({
    defaultProvider: "google-generative-ai" as const,
    providers: {
      openai: { apiKey: "", model: "gpt-4o", baseUrl: "" },
      "google-generative-ai": { apiKey: "", model: "gemini-1.5-flash" },
      minimax: {
        apiKey: "",
        model: "MiniMax-M3",
        baseUrl: "https://api.MiniMax.io/anthropic",
      },
    },
  })),
  recentProjects: z.array(z.string()).default([]),
});

/**
 * Settings represents the complete top-level user and project settings structure.
 */
export type Settings = z.infer<typeof settingsSchema>;
