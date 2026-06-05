import { join, isAbsolute, relative, resolve } from "path";

export const getAbsPath = (workspaceDir: string, pathStr: string): string => {
  if (!workspaceDir) {
    throw new Error("Workspace directory is not set");
  }
  const absPath = isAbsolute(pathStr)
    ? resolve(pathStr)
    : resolve(join(workspaceDir, pathStr));
  const relPath = relative(resolve(workspaceDir), absPath);

  if (relPath.startsWith("..") || isAbsolute(relPath)) {
    throw new Error(
      `Path security violation: ${pathStr} is outside of workspace directory: ${workspaceDir}`,
    );
  }
  return absPath;
};
