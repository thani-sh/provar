import { join } from "path";

export const WORKSPACE_DIR = process.env.PROVAR_WORKSPACE || process.cwd();

export const getAbsPath = (path: string) => join(WORKSPACE_DIR, path);
