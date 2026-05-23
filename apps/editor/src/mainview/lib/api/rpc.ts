import { Electroview } from "electrobun/view";
import type { ProvarRPCSchema } from "../../../shared/rpc";

export const rpc = Electroview.defineRPC<ProvarRPCSchema>({
  maxRequestTime: 120000,
  handlers: {
    messages: {
      workspaceSelected: (params) => {
        handlers.workspaceSelected?.(params.path);
      },
      workspaceChanged: () => {
        handlers.workspaceChanged?.();
      },
      assistantChunk: (params) => {
        handlers.assistantChunk?.(params);
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
};

const handlers: Handlers = {};

export function registerRPCHandlers(newHandlers: Handlers) {
  Object.assign(handlers, newHandlers);
}
