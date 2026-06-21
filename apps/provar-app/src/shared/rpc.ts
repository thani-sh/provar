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
        response: { settings: Settings; home: string; settingsExists: boolean };
      };
      saveSettings: {
        params: { settings: Partial<Settings> };
        response: { settings: Settings };
      };
      openProject: {
        params: { path: string };
        response: { success: boolean };
      };
      selectProject: {
        params: {};
        response: { success: boolean; path?: string };
      };
      getConfig: {
        params: {};
        response: { config: ProvarConfig | null };
      };
      getProject: {
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
      getNodeGeneratedCode: {
        params: { testPath: string; taskId: string };
        response: { code: string | null; upToDate: boolean };
      };
      createSampleProject: {
        params: {};
        response: { success: boolean; path?: string; error?: string };
      };
      openExternal: {
        params: { url: string };
        response: { success: boolean };
      };
      cancelRun: {
        params: { runId: string };
        response: { success: boolean };
      };
    };
    messages: {
      steamBunMessage: SteamBunMessage;
    };
  }>;
  webview: RPCSchema<{
    messages: {
      projectOpened: {
        params: { path: string };
      };
      projectChanged: {
        params: {};
      };
      openSettings: {
        params: {};
      };
      settingsChanged: {
        params: {};
      };
      steamBunMessage: SteamBunMessage;
    };
  }>;
};
