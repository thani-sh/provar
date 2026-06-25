import * as fs from "fs";
import * as path from "path";

// Recursively find all files of a specific extension
export function findFilesByExtension(
  targetPath: string,
  extension: string,
): string[] {
  const fileList: string[] = [];

  function scan(current: string) {
    if (!fs.existsSync(current)) return;
    const stat = fs.statSync(current);

    if (stat.isDirectory()) {
      const children = fs.readdirSync(current);
      for (const child of children) {
        scan(path.join(current, child));
      }
    } else if (stat.isFile() && current.endsWith(extension)) {
      fileList.push(current);
    }
  }

  scan(targetPath);
  return fileList;
}
