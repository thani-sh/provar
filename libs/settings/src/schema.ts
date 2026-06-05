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
 * modelSettingsSchema defines the LLM provider selection and per-provider credentials.
 */
export const modelSettingsSchema = z.object({
  defaultProvider: z
    .enum(["openai", "google-generative-ai"])
    .default("google-generative-ai"),
  providers: z
    .object({
      openai: openaiProviderSchema.default({}),
      "google-generative-ai": googleProviderSchema.default({}),
    })
    .default({}),
});

export type ModelSettings = z.infer<typeof modelSettingsSchema>;

// ---------------------------------------------------------------------------
// SettingsSchema
// ---------------------------------------------------------------------------

/**
 * settingsSchema is the full application settings schema stored on disk.
 */
export const settingsSchema = z.object({
  placeholder: z.string().default("placeholder-value"),
  models: modelSettingsSchema.default({}),
  recentWorkspaces: z.array(z.string()).default([]),
});

export type Settings = z.infer<typeof settingsSchema>;
