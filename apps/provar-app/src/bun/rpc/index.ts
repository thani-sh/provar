import { BrowserView } from "electrobun/bun";
import { type ProvarRPCSchema } from "../../shared/rpc";

import { compileTest } from "./handlers/compile-test";
import { runTestPath } from "./handlers/run-test-path";
import { acceptVisualState } from "./handlers/accept-visual-state";
import { getScreenshots } from "./handlers/get-screenshots";
import { assistEditor } from "./handlers/assist-editor";
import {
  openWorkspace,
  selectWorkspace,
  getWorkspace,
} from "./handlers/workspace-handlers";
import {
  getSettings,
  saveSettings,
  getConfig,
  saveConfig,
} from "./handlers/config-handlers";
import {
  listFiles,
  readFile,
  writeFile,
  createFile,
  createDirectory,
  deletePath,
} from "./handlers/file-handlers";

export const provarRPC = BrowserView.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    requests: {
      getSettings,
      saveSettings,
      openWorkspace,
      selectWorkspace,
      getConfig,
      getWorkspace,
      saveConfig,
      listFiles,
      readFile,
      writeFile,
      createFile,
      createDirectory,
      deletePath,
      compileTest,
      runTestPath,
      acceptVisualState,
      getScreenshots,
      assistEditor,
    },
  },
});
