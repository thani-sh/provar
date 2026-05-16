import { rm } from "fs/promises";
import { getAbsPath, triggerWorkspaceChanged } from "../utils";

export const deletePath = async ({ path }: { path: string }) => {
    try {
        console.log(`[BUN] Deleting path: ${path}`);
        const fullPath = getAbsPath(path);
        await rm(fullPath, { recursive: true, force: true });
        console.log(`[BUN] Path deleted successfully: ${fullPath}`);
        triggerWorkspaceChanged();
        return { success: true };
    } catch (error) {
        console.error(`[BUN] Failed to delete path ${path}:`, error);
        throw error;
    }
};
