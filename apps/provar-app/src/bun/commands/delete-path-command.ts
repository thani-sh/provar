import { rm } from "fs/promises";
import { z } from "zod";
import { Command } from "./command";
import { getAbsPath } from "./utils";

export type DeletePathInput = {
  path: string;
};
export type DeletePathOutput = {
  success: boolean;
};

export class DeletePathCommand extends Command<
  DeletePathInput,
  DeletePathOutput
> {
  readonly name = "deletePath";
  readonly title = "Delete Path";
  readonly description =
    "Deletes a file or directory from the workspace recursively.";
  readonly inputSchema = z.object({
    path: z.string(),
  });
  readonly outputSchema = z.object({
    success: z.boolean(),
  });

  async execute(input: DeletePathInput): Promise<DeletePathOutput> {
    try {
      console.log(`[BUN] Deleting path: ${input.path}`);
      const fullPath = getAbsPath(this.context.workspaceDir, input.path);
      await rm(fullPath, { recursive: true, force: true });
      console.log(`[BUN] Path deleted successfully: ${fullPath}`);
      return { success: true };
    } catch (error) {
      console.error(`[BUN] Failed to delete path ${input.path}:`, error);
      throw error;
    }
  }
}
