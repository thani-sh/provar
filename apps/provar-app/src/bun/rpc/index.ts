import { BrowserView } from "electrobun/bun";
import { type ProvarRPCSchema } from "../../shared/rpc";

import { acceptVisualState } from "./handlers/accept-visual-state";
import { getScreenshots } from "./handlers/get-screenshots";
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
      acceptVisualState,
      getScreenshots,
    },
    messages: {
      steamBunMessage: SteamBun.messages.steamBunMessage,
    },
  },
});
