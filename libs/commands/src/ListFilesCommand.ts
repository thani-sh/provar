import { readdir } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { Command } from "./Command";
import { getAbsPath } from "./utils";
import { TESTS_DIR } from "@libs/domain/zod";

export type ListFilesInput = Record<string, never>;
export type ListFilesOutput = {
  tests: string[];
};

export class ListFilesCommand extends Command<ListFilesInput, ListFilesOutput> {
  readonly name = "listFiles";
  readonly title = "List Test Files";
  readonly description =
    "Lists all test YAML files within the tests directory.";
  readonly inputSchema = z.object({});
  readonly outputSchema = z.object({
    tests: z.array(z.string()),
  });

  async execute(): Promise<ListFilesOutput> {
    const tests: string[] = [];

    const scan = async (dir: string, extension: string, results: string[]) => {
      try {
        const fullAbsPath = getAbsPath(this.context.workspaceDir, dir);
        const entries = await readdir(fullAbsPath, { withFileTypes: true });
        for (const entry of entries) {
          const relativePath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await scan(relativePath, extension, results);
          } else if (entry.name.endsWith(extension)) {
            results.push(relativePath);
          }
        }
      } catch (e) {
        console.warn(`Could not read directory ${dir}`, e);
      }
    };

    await scan(TESTS_DIR, ".test.yml", tests);

    return { tests };
  }
}
