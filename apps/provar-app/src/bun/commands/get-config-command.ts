import { readFile, access } from "fs/promises";
import yaml from "yaml";
import { z } from "zod";
import { Command } from "./command";
import { getAbsPath } from "./utils";
import { CONFIG_FILE, configSchema } from "@libs/domain/zod";

export type GetConfigInput = Record<string, never>;
export type GetConfigOutput = {
  config: z.infer<typeof configSchema> | null;
};

export class GetConfigCommand extends Command<GetConfigInput, GetConfigOutput> {
  readonly name = "getConfig";
  readonly title = "Get Configuration";
  readonly description =
    "Reads the Provar configuration file from the workspace.";
  readonly inputSchema = z.object({});
  readonly outputSchema = z.object({
    config: configSchema.nullable(),
  });

  async execute(): Promise<GetConfigOutput> {
    try {
      const configPath = getAbsPath(this.context.workspaceDir, CONFIG_FILE);
      await access(configPath);
      const content = await readFile(configPath, "utf-8");
      const parsed = yaml.parse(content);
      const config = configSchema.parse(parsed);
      return { config };
    } catch (e) {
      return { config: null };
    }
  }
}
