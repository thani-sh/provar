import { type RPCSchema } from "electrobun/types";
import type { TestFile, ProvarConfig } from "@libs/domain/zod";
import type { Settings } from "@libs/config";

export type SteamBunMessage = {
  type: "start" | "next" | "error" | "done" | "cancel";
  stream: string;
  method?: string;
  content?: unknown;
};

/**
 * ProvarRPCSchema defines the type schema for bidirectional RPC communication between Bun and WebView.
 */
export type ProvarRPCSchema = {
  bun: RPCSchema<{
    requests: {
      getSettings: {
        params: {};
        response: { settings: Settings; home: string };
      };
      saveSettings: {
        params: { settings: Partial<Settings> };
        response: { settings: Settings };
      };
      openWorkspace: {
        params: { path: string };
        response: { success: boolean };
      };
      selectWorkspace: {
        params: {};
        response: { success: boolean; path?: string };
      };
      getConfig: {
        params: {};
        response: { config: ProvarConfig | null };
      };
      getWorkspace: {
        params: {};
        response: { path: string };
      };
      saveConfig: {
        params: { config: ProvarConfig };
        response: { success: boolean };
      };
      listFiles: {
        params: {};
        response: { tests: string[] };
      };
      readFile: {
        params: { path: string };
        response: { content: TestFile };
      };
      writeFile: {
        params: { path: string; content: TestFile };
        response: { success: boolean };
      };
      createFile: {
        params: { path: string; name: string };
        response: { success: boolean };
      };
      createDirectory: {
        params: { path: string };
        response: { success: boolean };
      };
      deletePath: {
        params: { path: string };
        response: { success: boolean };
      };
      acceptVisualState: {
        params: { testPath: string; pathIndex: number; taskId: string };
        response: { success: boolean };
      };
      getScreenshots: {
        params: { testPath: string; pathIndex: number; taskId: string };
        response: { baseline?: string; current?: string };
      };
    };
    messages: {
      steamBunMessage: {
        params: SteamBunMessage;
      };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      workspaceSelected: {
        params: { path: string };
      };
      workspaceChanged: {
        params: {};
      };
      openSettings: {
        params: {};
      };
      settingsChanged: {
        params: {};
      };
      steamBunMessage: {
        params: SteamBunMessage;
      };
    };
  }>;
};
