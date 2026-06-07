import {
  createClient,
  convertCommandsToTools,
  type Message,
} from "@libs/models";
import { createCommands } from "../../commands";
import { WORKSPACE_DIR } from "../../utils";
import { getAgentConfig } from "../context";
import { getMainWindow } from "../../window/window-registry";

const getCommands = () => createCommands({ workspaceDir: WORKSPACE_DIR });

export const assistEditor = async (params: {
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  path?: string;
}) => {
  console.log("[RPC Server] assistEditor request:", params);
  try {
    const client = createClient(getAgentConfig());

    // Get commands for the workspace and map them to Vercel AI SDK tools
    const commands = getCommands();
    const tools = convertCommandsToTools(commands);

    const session = await client.session({ tools });

    // Map the history payload into agent-compatible Message objects
    const messages: Message[] = (params.history || []).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    // Append current prompt as the last message
    messages.push({
      role: "user",
      content: params.prompt,
    });

    const mainWindow = getMainWindow();

    (async () => {
      try {
        for await (const chunk of session.prompt(messages)) {
          if (chunk.type === "text") {
            mainWindow.webview.rpc?.send.assistantChunk({
              params: {
                text: chunk.text,
                status: "pending",
              },
            });
          }
        }
        mainWindow.webview.rpc?.send.assistantChunk({
          params: {
            text: "",
            status: "completed",
          },
        });
      } catch (err: any) {
        console.error("[RPC Server] assistEditor stream error:", err);
        mainWindow.webview.rpc?.send.assistantChunk({
          params: {
            text: `\nError: ${err.message}`,
            status: "error",
          },
        });
      } finally {
        await client.close();
      }
    })();

    return {
      message: "",
    };
  } catch (err: any) {
    console.error("[RPC Server] assistEditor init error:", err);
    const mainWindow = getMainWindow();
    mainWindow.webview.rpc?.send.assistantChunk({
      params: {
        text: `Initialization Error: ${err.message}`,
        status: "error",
      },
    });
    return {
      message: `Initialization Error: ${err.message}`,
    };
  }
};
