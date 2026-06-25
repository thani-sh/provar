import { join, isAbsolute, relative, resolve } from "path";

/**
 * getAbsPath resolves a path string relative to the project directory and validates security constraints.
 */
export const getAbsPath = (projectDir: string, pathStr: string): string => {
  if (!projectDir) {
    throw new Error("Project directory is not set");
  }
  const absPath = isAbsolute(pathStr)
    ? resolve(pathStr)
    : resolve(join(projectDir, pathStr));
  const relPath = relative(resolve(projectDir), absPath);

  if (relPath.startsWith("..") || isAbsolute(relPath)) {
    throw new Error(
      `Path security violation: ${pathStr} is outside of project directory: ${projectDir}`,
    );
  }
  return absPath;
};
