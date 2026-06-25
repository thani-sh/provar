import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import yaml from "yaml";
import { z } from "zod";
import { Command } from "./command";
import { getAbsPath } from "./utils";
import { schemaForFile } from "@libs/domain/zod";

export type WriteFileInput = {
  path: string;
  content: z.infer<typeof schemaForFile>;
};
export type WriteFileOutput = {
  success: boolean;
};

export class WriteFileCommand extends Command<WriteFileInput, WriteFileOutput> {
  readonly name = "writeFile";
  readonly title = "Write Test File";
  readonly description = "Writes and updates a Provar test YAML file.";
  readonly inputSchema = z.object({
    path: z.string(),
    content: schemaForFile,
  });
  readonly outputSchema = z.object({
    success: z.boolean(),
  });

  async execute(input: WriteFileInput): Promise<WriteFileOutput> {
    const fullPath = getAbsPath(this.context.projectDir, input.path);
    const yamlContent = yaml.stringify(input.content);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, yamlContent, "utf-8");
    return { success: true };
  }
}
