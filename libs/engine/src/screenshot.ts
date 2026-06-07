import * as fs from "fs";
import * as path from "path";
import os from "os";

/**
 * Saves a screenshot buffer to the OS temporary directory under a specified prefix.
 *
 * @param buf Screenshot image buffer (PNG).
 * @param prefix Prefix for the generated file name.
 * @returns The absolute file path of the saved screenshot.
 */
export function saveScreenshotToTmp(buf: Buffer, prefix: string): string {
  const screenshotsDir = path.join(os.tmpdir(), "provar-screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });
  const fileName = `${prefix}-${Date.now()}.png`;
  const filePath = path.join(screenshotsDir, fileName);
  fs.writeFileSync(filePath, buf);
  return filePath;
}
