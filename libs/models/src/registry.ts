import { AISDKClient } from "./client";
import type { Client, AgentClientConfig } from "./types";

/**
 * ProviderConfigError is thrown by `createClient` when the supplied
 * `AgentClientConfig` has no API key. The error is intentionally distinct
 * from the AI SDK's own auth error so callers (CLI, desktop app, tests) can
 * present a clear "open Settings and add a key" message before a request is
 * ever sent.
 */
export class ProviderConfigError extends Error {
  readonly provider: AgentClientConfig["provider"];
  constructor(provider: AgentClientConfig["provider"]) {
    super(
      `AI provider "${provider}" is not configured: an API key is required. ` +
        `Add one in the Provar settings (or via \`bun run provar --config\`) and try again.`,
    );
    this.name = "ProviderConfigError";
    this.provider = provider;
  }
}

/**
 * createClient initializes a new AI SDK client instance based on the provided configuration.
 *
 * Throws `ProviderConfigError` if the config is missing the API key. The
 * compile pipeline (and any other AI-driven flow) refuses to start a session
 * without a key, because every underlying provider SDK will otherwise send an
 * unauthenticated request and surface a confusing 401 deep inside the call.
 */
export function createClient(config: AgentClientConfig): Client {
  if (!config.apiKey || config.apiKey.trim() === "") {
    throw new ProviderConfigError(config.provider);
  }
  return new AISDKClient(config);
}
