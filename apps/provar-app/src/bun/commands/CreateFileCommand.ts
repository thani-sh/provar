import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import yaml from "yaml";
import { z } from "zod";
import { Command } from "./Command";
import { getAbsPath } from "./utils";

export type CreateFileInput = {
  path: string;
  name: string;
};
export type CreateFileOutput = {
  success: boolean;
};

export class CreateFileCommand extends Command<
  CreateFileInput,
  CreateFileOutput
> {
  readonly name = "createFile";
  readonly title = "Create Test File";
  readonly description =
    "Creates a new test YAML file with a default starting graph.";
  readonly inputSchema = z.object({
    path: z.string(),
    name: z.string(),
  });
  readonly outputSchema = z.object({
    success: z.boolean(),
  });

  async execute(input: CreateFileInput): Promise<CreateFileOutput> {
    try {
      console.log(`[BUN] Creating file: ${input.path} (name: ${input.name})`);
      const randomId = Math.random().toString(36).substring(2, 7);
      const defaultContent = {
        name: input.name,
        graph: {
          info: "New test graph",
          start: `task_${randomId}`,
          nodes: {
            [`task_${randomId}`]: {
              title: "Start Task",
              info: "Describe the first step here",
            },
          },
        },
      };
      const yamlContent = yaml.stringify(defaultContent);
      const fullPath = getAbsPath(this.context.workspaceDir, input.path);
      console.log(`[BUN] Full path: ${fullPath}`);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, yamlContent, "utf-8");
      console.log(`[BUN] File created successfully: ${fullPath}`);
      return { success: true };
    } catch (error) {
      console.error(`[BUN] Failed to create file ${input.path}:`, error);
      throw error;
    }
  }
}
