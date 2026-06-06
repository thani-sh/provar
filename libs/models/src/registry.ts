import { AISDKClient } from "./client";
import type { Client, AgentClientConfig } from "./types";

export function createClient(config: AgentClientConfig): Client {
  return new AISDKClient(config);
}
