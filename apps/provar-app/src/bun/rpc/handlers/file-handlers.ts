import { createCommands } from "../../commands";
import { PROJECT_DIR, triggerProjectChanged } from "../../utils";

const getCommands = () => createCommands({ projectDir: PROJECT_DIR });

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
  // No `triggerProjectChanged()` here: the fs.watch in `utils.ts` already
  // fires on every disk change (with a 100 ms debounce) and triggers the
  // same projectChanged → refreshFiles chain. Calling it from writeFile too
  // used to fire a duplicate refresh for every keystroke — the panel was
  // issuing one writeFile per character, so the editor-store saw an extra
  // refreshFiles on top of the fs.watch one, every time. Per-keystroke
  // refreshFiles was responsible for the editor lag and the per-keystroke
  // console volume (T007). See docs/TODOS.md T004.
  return res;
};

export const createFile = async (params: { path: string; name: string }) => {
  console.log("[RPC Server] createFile request:", params);
  const res = await getCommands().createFile.execute(params);
  console.log("[RPC Server] createFile response:", res);
  triggerProjectChanged();
  return res;
};

export const createDirectory = async (params: { path: string }) => {
  console.log("[RPC Server] createDirectory request:", params);
  const res = await getCommands().createDirectory.execute(params);
  console.log("[RPC Server] createDirectory response:", res);
  triggerProjectChanged();
  return res;
};

export const deletePath = async (params: { path: string }) => {
  console.log("[RPC Server] deletePath request:", params);
  const res = await getCommands().deletePath.execute(params);
  console.log("[RPC Server] deletePath response:", res);
  triggerProjectChanged();
  return res;
};
