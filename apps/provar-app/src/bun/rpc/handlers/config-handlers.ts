import { Utils } from "electrobun/bun";
import {
  loadSettings,
  saveSettings as saveSettingsLib,
} from "../../lib/settings";
import { createCommands } from "../../commands";
import { PROJECT_DIR } from "../../utils";

const getCommands = () => createCommands({ projectDir: PROJECT_DIR });

export const getSettings = async () => {
  console.log("[RPC Server] getSettings request");
  const settings = loadSettings();
  console.log("[RPC Server] getSettings response:", settings);
  return { settings, home: Utils.paths.home };
};

export const saveSettings = async (params: { settings: any }) => {
  console.log("[RPC Server] saveSettings request:", params);
  const settings = saveSettingsLib(params.settings);
  console.log("[RPC Server] saveSettings response:", settings);
  return { settings };
};

export const getConfig = async () => {
  console.log("[RPC Server] getConfig request");
  const res = await getCommands().getConfig.execute();
  console.log("[RPC Server] getConfig response:", res);
  return res;
};

export const saveConfig = async (params: { config: any }) => {
  console.log("[RPC Server] saveConfig request:", params);
  const res = await getCommands().saveConfig.execute(params);
  console.log("[RPC Server] saveConfig response:", res);
  return res;
};
