import type { ModelSettings } from "@libs/settings";
import { AISDKClient } from "./client";
import type { Client } from "./types";

export function createClient(settings: ModelSettings): Client {
  return new AISDKClient(settings);
}
