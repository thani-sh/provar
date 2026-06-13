import { BrowserWindow, Updater } from "electrobun/bun";
import { provarRPC } from "../rpc";
import { setMainWindow } from "./window-registry";
import { SteamBun } from "@thani-sh/steam-bun/bun";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const url = await getMainViewUrl();

  const mainWindow = new BrowserWindow({
    title: "Provar Editor",
    url,
    renderer: "native",
    frame: {
      width: 1200,
      height: 800,
      x: 200,
      y: 200,
    },
    rpc: provarRPC,
    titleBarStyle: "hiddenInset",
  });

  // Bind the WKWebView to the SteamBun RPC streaming instance
  SteamBun.bind(mainWindow.webview);

  setMainWindow(mainWindow);
  return mainWindow;
}
