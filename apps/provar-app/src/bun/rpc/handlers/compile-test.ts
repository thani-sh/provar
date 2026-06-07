import { compile } from "@libs/engine";
import { getAbsPath } from "../../utils";
import { getAgentConfig } from "../context";

export const compileTest = async (params: { path: string }) => {
  const absPath = getAbsPath(params.path);
  console.log("[RPC Server] compileTest request for:", absPath);
  try {
    const res = await compile({
      yamlPath: absPath,
      agentConfig: getAgentConfig(),
    });
    console.log("[RPC Server] compileTest response success:", res.success);
    return { success: res.success };
  } catch (err: any) {
    console.error("[RPC Server] compileTest error:", err);
    return { success: false, error: err?.message || String(err) };
  }
};
