import { Electroview } from "electrobun/view";
import type { ProvarRPCSchema } from "../../../shared/rpc";

export const rpc = Electroview.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    messages: {
      workspaceSelected: (params) => {
        handlers.workspaceSelected?.(params.params.path);
      },
      workspaceChanged: () => {
        handlers.workspaceChanged?.();
      },
      assistantChunk: (params) => {
        handlers.assistantChunk?.(params.params);
      },
      testRunEvent: (params) => {
        console.log(
          "[RPC Client] Received testRunEvent notification:",
          params.params,
        );
        handlers.testRunEvent?.(params.params);
      },
      openSettings: () => {
        handlers.openSettings?.();
      },
      settingsChanged: () => {
        handlers.settingsChanged?.();
      },
    },
  },
});

export const electroview = new Electroview({ rpc });

type Handlers = {
  workspaceSelected?: (path: string) => void;
  workspaceChanged?: () => void;
  assistantChunk?: (params: {
    text: string;
    status: "pending" | "completed" | "error";
  }) => void;
  testRunEvent?: (params: {
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
  }) => void;
  openSettings?: () => void;
  settingsChanged?: () => void;
};

const handlers: Handlers = {};

export function registerRPCHandlers(newHandlers: Handlers) {
  Object.assign(handlers, newHandlers);
}
