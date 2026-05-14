import { type RPCSchema } from "electrobun/types";
import type { TestFile, ProvarConfig } from "./domain";

export type ProvarRPCSchema = {
  bun: RPCSchema<{
    requests: {
      getConfig: {
        params: {};
        response: { config: ProvarConfig | null };
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
    };
  }>;
  webview: RPCSchema<{
    messages: {
      // In the future, we might send progress updates here
    };
  }>;
};
