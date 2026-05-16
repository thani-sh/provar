import { join } from "path";

export let WORKSPACE_DIR = process.env.PROVAR_WORKSPACE_DIR || "";

export const setWorkspaceDir = (path: string) => {
    WORKSPACE_DIR = path;
};

export const getAbsPath = (path: string) => join(WORKSPACE_DIR, path);
