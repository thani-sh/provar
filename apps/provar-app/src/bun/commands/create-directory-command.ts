import { mkdir } from "fs/promises";
import { z } from "zod";
import { Command } from "./command";
import { getAbsPath } from "./utils";

export type CreateDirectoryInput = {
  path: string;
};
export type CreateDirectoryOutput = {
  success: boolean;
};

export class CreateDirectoryCommand extends Command<
  CreateDirectoryInput,
  CreateDirectoryOutput
> {
  readonly name = "createDirectory";
  readonly title = "Create Directory";
  readonly description = "Creates a directory recursively under the workspace.";
  readonly inputSchema = z.object({
    path: z.string(),
  });
  readonly outputSchema = z.object({
    success: z.boolean(),
  });

  async execute(input: CreateDirectoryInput): Promise<CreateDirectoryOutput> {
    try {
      console.log(`[BUN] Creating directory: ${input.path}`);
      const fullPath = getAbsPath(this.context.workspaceDir, input.path);
      console.log(`[BUN] Full path: ${fullPath}`);
      await mkdir(fullPath, { recursive: true });
      console.log(`[BUN] Directory created successfully: ${fullPath}`);
      return { success: true };
    } catch (error) {
      console.error(`[BUN] Failed to create directory ${input.path}:`, error);
      throw error;
    }
  }
}
