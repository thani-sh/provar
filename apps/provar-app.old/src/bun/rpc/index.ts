import { BrowserView } from "electrobun/bun";
import { type ProvarRPCSchema } from "../../shared/rpc";

import { acceptVisualState } from "./handlers/accept-visual-state";
import { getScreenshots } from "./handlers/get-screenshots";
import { getNodeGeneratedCodeRpc } from "./handlers/get-node-generated-code";
import { createSampleProject } from "./handlers/sample-project";
import { openExternal } from "./handlers/open-external";
import {
  openProject,
  selectProject,
  getProject,
} from "./handlers/project-handlers";
import { cancelRun } from "./streams";
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

import { SteamBun } from "@thani-sh/steam-bun/bun";
import { registerStreams } from "./streams";

// Initialize and register all SteamBun RPC streams
registerStreams();

export const provarRPC = BrowserView.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    requests: {
      getSettings,
      saveSettings,
      openProject,
      selectProject,
      getConfig,
      getProject,
      saveConfig,
      listFiles,
      readFile,
      writeFile,
      createFile,
      createDirectory,
      deletePath,
      acceptVisualState,
      getScreenshots,
      getNodeGeneratedCode: getNodeGeneratedCodeRpc,
      createSampleProject,
      openExternal,
      cancelRun,
    },
    messages: {
      steamBunMessage: SteamBun.messages.steamBunMessage,
    },
  },
});
