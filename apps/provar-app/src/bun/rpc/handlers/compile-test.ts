import { compileProgress } from "@libs/engine";
import { getAbsPath } from "../../utils";
import { getAgentConfig } from "../context";
import { getMainWindow } from "../../window/window-registry";

export const compileTest = async (params: { path: string }) => {
  const absPath = getAbsPath(params.path);
  console.log("[RPC Server] compileTest request for:", absPath);
  try {
    const mainWindow = getMainWindow();
    const generator = compileProgress({
      yamlPath: absPath,
      agentConfig: getAgentConfig(),
    });

    let success = false;
    for await (const event of generator) {
      console.log(
        `[RPC Server] Compile Event: ${event.type}`,
        "nodeId" in event ? event.nodeId : "",
      );
      mainWindow.webview.rpc?.send.compileProgressEvent({
        params: {
          yamlPath: absPath,
          type: event.type,
          nodeId: "nodeId" in event ? event.nodeId : undefined,
          title: "title" in event ? event.title : undefined,
          error: "error" in event ? event.error : undefined,
        },
      });
      if (event.type === "compile-finished") {
        success = event.success;
      }
    }
    return { success };
  } catch (err: any) {
    console.error("[RPC Server] compileTest error:", err);
    return { success: false, error: err?.message || String(err) };
  }
};
