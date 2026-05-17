import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import yaml from "yaml";
import {
  CONFIG_FILE,
  SUITES_DIR,
  NODES_DIR,
  type ProvarConfig,
} from "../../shared/domain";
import { getAbsPath } from "../utils";

export const saveConfig = async ({ config }: { config: ProvarConfig }) => {
  try {
    const configPath = getAbsPath(CONFIG_FILE);
    const yamlContent = yaml.stringify(config);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, yamlContent, "utf-8");

    // Also ensure suites and nodes dirs exist
    await mkdir(getAbsPath(SUITES_DIR), { recursive: true });
    await mkdir(getAbsPath(NODES_DIR), { recursive: true });

    return { success: true };
  } catch (e) {
    console.error("Failed to save config", e);
    return { success: false };
  }
};
