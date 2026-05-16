import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import yaml from "yaml";
import { getAbsPath, triggerWorkspaceChanged } from "../utils";

export const createFile = async ({ path, name }: { path: string, name: string }) => {
    try {
        console.log(`[BUN] Creating file: ${path} (name: ${name})`);
        const randomId = Math.random().toString(36).substring(2, 7);
        const defaultContent = {
            name: name,
            graph: {
                info: "New test graph",
                start: `action_${randomId}`,
                nodes: {
                    [`action_${randomId}`]: {
                        title: "Start Action",
                        info: "Describe the first step here"
                    }
                }
            }
        };
        const yamlContent = yaml.stringify(defaultContent);
        const fullPath = getAbsPath(path);
        console.log(`[BUN] Full path: ${fullPath}`);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, yamlContent, "utf-8");
        console.log(`[BUN] File created successfully: ${fullPath}`);
        triggerWorkspaceChanged();
        return { success: true };
    } catch (error) {
        console.error(`[BUN] Failed to create file ${path}:`, error);
        throw error;
    }
};
