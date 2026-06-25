import { loadSettings } from "../lib/settings";

export const activeRunners = new Map<string, any>();

export function getAgentConfig() {
  const settings = loadSettings();
  const provider = settings.models.defaultProvider;
  const cfg = settings.models.providers[provider];
  return {
    provider,
    apiKey: cfg.apiKey,
    model: cfg.model,
    baseUrl: (cfg as any).baseUrl,
  };
}
