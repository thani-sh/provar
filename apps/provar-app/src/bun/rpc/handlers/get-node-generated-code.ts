import * as crypto from "crypto";
import * as fs from "fs";
import { getNodeGeneratedCode } from "@libs/engine";
import { getAbsPath } from "../../utils";

/**
 * getNodeGeneratedCode returns the source text of the compiled execute
 * function for a single task, extracted from the .test.ts file the
 * compiler produced next to the test .yml on disk. The handler verifies
 * the compiled file is in sync with the YAML (hash match) and returns
 * `upToDate: false` if it is stale or missing, so the UI can show a
 * "recompile first" hint instead of misleading code.
 */
export const getNodeGeneratedCodeRpc = async (params: {
  testPath: string;
  taskId: string;
}): Promise<{ code: string | null; upToDate: boolean }> => {
  console.log("[RPC Server] getNodeGeneratedCode request:", params);

  const absPath = getAbsPath(params.testPath);
  const tsPath = absPath.replace(".test.yml", ".test.ts");

  if (!fs.existsSync(tsPath)) {
    return { code: null, upToDate: false };
  }

  // Re-hash the YAML and compare with the // hash: <hex> comment the
  // compiler writes on line 1. This mirrors the engine's parseTestFile
  // check, so "up to date" has the same meaning in both places.
  const yamlContent = fs.readFileSync(absPath, "utf-8");
  const yamlHash = crypto
    .createHash("sha256")
    .update(yamlContent)
    .digest("hex");
  const tsFirstLine = fs.readFileSync(tsPath, "utf-8").split("\n", 1)[0] ?? "";
  const hashMatch = tsFirstLine.match(/^\/\/ hash: ([a-f0-9]+)$/);
  if (!hashMatch || hashMatch[1] !== yamlHash) {
    return { code: null, upToDate: false };
  }

  const code = getNodeGeneratedCode(tsPath, params.taskId);
  return { code, upToDate: true };
};
