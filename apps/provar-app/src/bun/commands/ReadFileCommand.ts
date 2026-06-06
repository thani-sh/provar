import { readFile } from "fs/promises";
import yaml from "yaml";
import { z } from "zod";
import { Command } from "./Command";
import { getAbsPath } from "./utils";
import { schemaForFile } from "@libs/domain/zod";
import { loadProject } from "@libs/engine";

export type ReadFileInput = {
  path: string;
};
export type ReadFileOutput = {
  content: z.infer<typeof schemaForFile>;
};

export class ReadFileCommand extends Command<ReadFileInput, ReadFileOutput> {
  readonly name = "readFile";
  readonly title = "Read Test File";
  readonly description = "Reads and validates a Provar test YAML file.";
  readonly inputSchema = z.object({
    path: z.string(),
  });
  readonly outputSchema = z.object({
    content: schemaForFile,
  });

  async execute(input: ReadFileInput): Promise<ReadFileOutput> {
    const fullPath = getAbsPath(this.context.workspaceDir, input.path);
    const contentStr = await readFile(fullPath, "utf-8");
    const parsed = yaml.parse(contentStr);
    const validated = schemaForFile.parse(parsed);

    const project = await loadProject(fullPath);
    const loadedFile = project.files.find((f) => f.path === fullPath);
    validated.code = loadedFile ? (loadedFile.code ?? null) : null;

    return { content: validated };
  }
}
