import { type RPCSchema } from "electrobun/types";
import type { TestFile, ProvarConfig } from "@libs/domain/zod";
import type { Settings } from "@libs/config";

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
      assistEditor: {
        params: {
          prompt: string;
          history?: { role: "user" | "assistant"; content: string }[];
          path?: string;
        };
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
      openSettings: {
        params: {};
      };
      settingsChanged: {
        params: {};
      };
    };
  }>;
};
