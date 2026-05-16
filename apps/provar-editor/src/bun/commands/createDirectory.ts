import { mkdir } from "fs/promises";
import { getAbsPath, triggerWorkspaceChanged } from "../utils";

export const createDirectory = async ({ path }: { path: string }) => {
    try {
        console.log(`[BUN] Creating directory: ${path}`);
        const fullPath = getAbsPath(path);
        console.log(`[BUN] Full path: ${fullPath}`);
        await mkdir(fullPath, { recursive: true });
        console.log(`[BUN] Directory created successfully: ${fullPath}`);
        triggerWorkspaceChanged();
        return { success: true };
    } catch (error) {
        console.error(`[BUN] Failed to create directory ${path}:`, error);
        throw error;
    }
};
