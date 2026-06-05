import { type RPCSchema } from "electrobun/types";
import type { TestFile, ProvarConfig } from "@libs/domain/zod";

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
      assistEditor: {
        params: { prompt: string; path?: string };
        response: {
          message: string;
          action?: {
            type: "selectFile";
            path: string;
          };
        };
      };
      compileTest: {
        params: { path: string };
        response: { success: boolean; error?: string };
      };
      runTestPath: {
        params: {
          path: string;
          pathIndex: number;
          upToTaskId?: string;
          headless?: boolean;
        };
        response: { success: boolean; runId?: string; error?: string };
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
  }>;
  webview: RPCSchema<{
    messages: {
      workspaceSelected: {
        params: { path: string };
      };
      workspaceChanged: {
        params: {};
      };
      assistantChunk: {
        params: { text: string; status: "pending" | "completed" | "error" };
      };
      testRunEvent: {
        params: {
          runId: string;
          type:
            | "run-started"
            | "task-started"
            | "task-finished"
            | "task-failed"
            | "visual-comparison-triggered"
            | "run-finished";
          taskId?: string;
          title?: string;
          error?: string;
          screenshotBase64?: string;
          visualCompare?: boolean;
          status?: string;
        };
      };
    };
  }>;
};
