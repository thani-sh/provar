import { Electroview } from "electrobun/view";
import type { ProvarRPCSchema } from "../../../shared/rpc";
import { SteamBun } from "@thani-sh/steam-bun/web";

/**
 * rpc is the WebView RPC instance defining how incoming messaging callbacks are handled.
 */
export const rpc = Electroview.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    messages: {
      projectOpened: (params) => {
        handlers.projectOpened?.(params.params.path);
      },
      projectChanged: () => {
        handlers.projectChanged?.();
      },
      openSettings: () => {
        handlers.openSettings?.();
      },
      settingsChanged: () => {
        handlers.settingsChanged?.();
      },
      steamBunMessage: SteamBun.messages.steamBunMessage,
    },
  },
});

/**
 * electroview is the core webview context wrapper.
 */
export const electroview = new Electroview({ rpc });

// Bind the electroview context to the SteamBun RPC streaming instance
SteamBun.bind(electroview);

type Handlers = {
  projectOpened?: (path: string) => void;
  projectChanged?: () => void;
  openSettings?: () => void;
  settingsChanged?: () => void;
};

const handlers: Handlers = {};

/**
 * registerRPCHandlers registers reactive handlers for notifications incoming from the Bun process.
 */
export function registerRPCHandlers(newHandlers: Handlers): void {
  Object.assign(handlers, newHandlers);
}
