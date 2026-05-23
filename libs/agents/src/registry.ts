import type { AgentProvider } from "./types";
import { GeminiCLIProvider } from "./providers/gemini-cli";

const providers = new Map<string, AgentProvider>();

const getProviderKey = (name: string, workspaceDir: string) =>
  `${name}:${workspaceDir}`;

export const getAgentProvider = (
  name: string,
  params: { systemPrompt: string; workspaceDir: string },
): AgentProvider | null => {
  const key = getProviderKey(name, params.workspaceDir);

  if (providers.has(key)) {
    return providers.get(key)!;
  }

  if (name === "gemini-cli") {
    const provider = new GeminiCLIProvider(params);
    providers.set(key, provider);
    return provider;
  }

  return null;
};

export const getAvailableProviders = (): string[] => {
  return ["gemini-cli"];
};
