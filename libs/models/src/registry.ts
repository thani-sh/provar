import { AISDKClient } from "./client";
import type { Client, AgentClientConfig } from "./types";

/**
 * createClient initializes a new AI SDK client instance based on the provided configuration.
 */
export function createClient(config: AgentClientConfig): Client {
  return new AISDKClient(config);
}
