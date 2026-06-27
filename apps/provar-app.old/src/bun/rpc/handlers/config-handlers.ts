import { Utils } from "electrobun/bun";
import {
  loadSettings,
  saveSettings as saveSettingsLib,
  settingsExists,
} from "../../lib/settings";
import { createCommands } from "../../commands";
import { PROJECT_DIR } from "../../utils";
import { debug, debugRedacted } from "../../../shared/debug";

const getCommands = () => createCommands({ projectDir: PROJECT_DIR });

export const getSettings = async () => {
  debug("[RPC Server] getSettings request");
  const settings = loadSettings();
  // settings includes `models.providers.*.apiKey` — redact before logging.
  debugRedacted("[RPC Server] getSettings response:", settings);
  return {
    settings,
    home: Utils.paths.home,
    // Tells the renderer whether ~/.provar/settings.json has ever been
    // written to disk. The WebView uses this to decide between showing the
    // first-run setup wizard and the regular settings modal.
    settingsExists: settingsExists(),
  };
};

export const saveSettings = async (params: { settings: any }) => {
  // The incoming settings payload also carries provider API keys — redact
  // before logging, even with debug enabled, so the dev console never
  // prints a real key.
  debugRedacted("[RPC Server] saveSettings request:", params);
  const settings = saveSettingsLib(params.settings);
  debugRedacted("[RPC Server] saveSettings response:", settings);
  return { settings };
};

export const getConfig = async () => {
  debug("[RPC Server] getConfig request");
  const res = await getCommands().getConfig.execute();
  // provarConfig may carry provider apiKey / password fields — redact.
  debugRedacted("[RPC Server] getConfig response:", res);
  return res;
};

export const saveConfig = async (params: { config: any }) => {
  debugRedacted("[RPC Server] saveConfig request:", params);
  const res = await getCommands().saveConfig.execute(params);
  debug("[RPC Server] saveConfig response:", res);
  return res;
};
