import { createCommands } from "../../commands";
import { WORKSPACE_DIR, triggerWorkspaceChanged } from "../../utils";

const getCommands = () => createCommands({ workspaceDir: WORKSPACE_DIR });

export const listFiles = async () => {
  console.log("[RPC Server] listFiles request");
  const res = await getCommands().listFiles.execute();
  console.log("[RPC Server] listFiles response test count:", res.tests.length);
  return res;
};

export const readFile = async (params: { path: string }) => {
  console.log("[RPC Server] readFile request:", params);
  const res = await getCommands().readFile.execute(params);
  console.log("[RPC Server] readFile response success:", !!res.content);
  return res;
};

export const writeFile = async (params: { path: string; content: any }) => {
  console.log("[RPC Server] writeFile request:", params);
  const res = await getCommands().writeFile.execute(params);
  console.log("[RPC Server] writeFile response:", res);
  triggerWorkspaceChanged();
  return res;
};

export const createFile = async (params: { path: string; name: string }) => {
  console.log("[RPC Server] createFile request:", params);
  const res = await getCommands().createFile.execute(params);
  console.log("[RPC Server] createFile response:", res);
  triggerWorkspaceChanged();
  return res;
};

export const createDirectory = async (params: { path: string }) => {
  console.log("[RPC Server] createDirectory request:", params);
  const res = await getCommands().createDirectory.execute(params);
  console.log("[RPC Server] createDirectory response:", res);
  triggerWorkspaceChanged();
  return res;
};

export const deletePath = async (params: { path: string }) => {
  console.log("[RPC Server] deletePath request:", params);
  const res = await getCommands().deletePath.execute(params);
  console.log("[RPC Server] deletePath response:", res);
  triggerWorkspaceChanged();
  return res;
};
