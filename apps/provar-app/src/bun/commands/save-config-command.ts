import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import yaml from "yaml";
import { z } from "zod";
import { Command } from "./command";
import { getAbsPath } from "./utils";
import { CONFIG_FILE, TESTS_DIR, configSchema } from "@libs/domain/zod";

export type SaveConfigInput = {
  config: z.infer<typeof configSchema>;
};
export type SaveConfigOutput = {
  success: boolean;
};

export class SaveConfigCommand extends Command<
  SaveConfigInput,
  SaveConfigOutput
> {
  readonly name = "saveConfig";
  readonly title = "Save Configuration";
  readonly description =
    "Saves the Provar configuration file and ensures required directories exist.";
  readonly inputSchema = z.object({
    config: configSchema,
  });
  readonly outputSchema = z.object({
    success: z.boolean(),
  });

  async execute(input: SaveConfigInput): Promise<SaveConfigOutput> {
    try {
      const configPath = getAbsPath(this.context.workspaceDir, CONFIG_FILE);
      const yamlContent = yaml.stringify(input.config);
      await mkdir(dirname(configPath), { recursive: true });
      await writeFile(configPath, yamlContent, "utf-8");

      // Also ensure tests dir exists
      const testsDir = getAbsPath(this.context.workspaceDir, TESTS_DIR);
      await mkdir(testsDir, { recursive: true });

      return { success: true };
    } catch (e) {
      console.error("Failed to save config", e);
      return { success: false };
    }
  }
}
