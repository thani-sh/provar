import { readdir } from "fs/promises";
import { join } from "path";
import { SUITES_DIR, NODES_DIR } from "../../shared/domain";
import { getAbsPath } from "../utils";

export const listFiles = async () => {
  const suites: string[] = [];
  const nodes: string[] = [];

  const scan = async (dir: string, extension: string, results: string[]) => {
    try {
      const entries = await readdir(getAbsPath(dir), { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath, extension, results);
        } else if (entry.name.endsWith(extension)) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      console.warn(`Could not read directory ${dir}`, e);
    }
  };

  await scan(SUITES_DIR, ".spec.yml", suites);
  await scan(NODES_DIR, ".node.yml", nodes);

  return { suites, nodes };
};
