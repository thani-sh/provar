import { type RPCSchema } from "electrobun/types";
import type { TestFile, ProvarConfig } from "./domain";

export type ProvarRPCSchema = {
  bun: RPCSchema<{
    requests: {
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
        response: { suites: string[]; nodes: string[] };
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
      assistEditor: {
        params: { prompt: string; path?: string };
        response: { 
          message: string;
          action?: {
            type: 'selectFile';
            path: string;
          };
        };
      };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      workspaceSelected: {
        params: { path: string };
      };
    };
  }>;
};
