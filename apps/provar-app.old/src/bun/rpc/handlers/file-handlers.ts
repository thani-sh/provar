import { createCommands } from "../../commands";
import { PROJECT_DIR, triggerProjectChanged } from "../../utils";
import { debug } from "../../../shared/debug";

const getCommands = () => createCommands({ projectDir: PROJECT_DIR });

export const listFiles = async () => {
  debug("[RPC Server] listFiles request");
  const res = await getCommands().listFiles.execute();
  debug("[RPC Server] listFiles response test count:", res.tests.length);
  return res;
};

export const readFile = async (params: { path: string }) => {
  debug("[RPC Server] readFile request:", params.path);
  const res = await getCommands().readFile.execute(params);
  debug("[RPC Server] readFile response success:", !!res.content);
  return res;
};

export const writeFile = async (params: { path: string; content: any }) => {
  // Log only the path, not the full `content` payload — writeFile is called
  // on every keystroke (see T004) and the TestFile object is large.
  debug("[RPC Server] writeFile request:", params.path);
  const res = await getCommands().writeFile.execute(params);
  debug("[RPC Server] writeFile response:", res);
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
  debug("[RPC Server] createFile request:", params.path, params.name);
  const res = await getCommands().createFile.execute(params);
  debug("[RPC Server] createFile response:", res);
  triggerProjectChanged();
  return res;
};

export const createDirectory = async (params: { path: string }) => {
  debug("[RPC Server] createDirectory request:", params.path);
  const res = await getCommands().createDirectory.execute(params);
  debug("[RPC Server] createDirectory response:", res);
  triggerProjectChanged();
  return res;
};

export const deletePath = async (params: { path: string }) => {
  debug("[RPC Server] deletePath request:", params.path);
  const res = await getCommands().deletePath.execute(params);
  debug("[RPC Server] deletePath response:", res);
  triggerProjectChanged();
  return res;
};
