import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import yaml from "yaml";
import { CONFIG_FILE, TESTS_DIR, type ProvarConfig } from "../../shared/domain";
import { getAbsPath } from "../utils";

export const saveConfig = async ({ config }: { config: ProvarConfig }) => {
  try {
    const configPath = getAbsPath(CONFIG_FILE);
    const yamlContent = yaml.stringify(config);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, yamlContent, "utf-8");

    // Also ensure tests dir exists
    await mkdir(getAbsPath(TESTS_DIR), { recursive: true });

    return { success: true };
  } catch (e) {
    console.error("Failed to save config", e);
    return { success: false };
  }
};
