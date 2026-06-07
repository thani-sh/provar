import * as fs from "fs";
import * as path from "path";
import os from "os";

/**
 * saveScreenshotToTmp saves a screenshot buffer to the OS temporary directory under a specified prefix.
 */
export function saveScreenshotToTmp(buf: Buffer, prefix: string): string {
  const screenshotsDir = path.join(os.tmpdir(), "provar-screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });
  const fileName = `${prefix}-${Date.now()}.png`;
  const filePath = path.join(screenshotsDir, fileName);
  fs.writeFileSync(filePath, buf);
  return filePath;
}
