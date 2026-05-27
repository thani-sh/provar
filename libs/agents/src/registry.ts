import type { Client } from "./types";
import { GeminiCLIClient } from "./client";

export function createClient(
  provider: "gemini-cli" | "copilot-cli",
  options: { workspaceDir: string },
): Client {
  if (provider === "gemini-cli") {
    return new GeminiCLIClient({ workspaceDir: options.workspaceDir });
  }
  if (provider === "copilot-cli") {
    throw new Error(`Provider 'copilot-cli' is not yet implemented.`);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}
