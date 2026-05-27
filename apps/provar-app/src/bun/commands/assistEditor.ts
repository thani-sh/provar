import { readFile } from "fs/promises";
import { getAbsPath, triggerWorkspaceChanged, WORKSPACE_DIR } from "../utils";
import { getConfig } from "./getConfig";
import { createClient, type Client, type Session } from "@libs/agents";

let activeClient: Client | null = null;
let activeSession: Session | null = null;
let activeProviderName: string = "";

const PROVAR_SYSTEM_PROMPT = `
You are the AI Assistant for Provar, a visual, graph-based end-to-end testing tool.
Provar represents tests as a directed graph of "tasks" (also referred to as nodes/actions).

### Testing Concepts:
- **Tests**: Top-level test files stored in ".provar/tests/*.test.yml".
- **Tasks**: Individual steps in a test (e.g., logging in).
- **Next**: Defines the flow from one task to the next (can be a single ID or an array for branching).

### YAML Schema:
Tests use YAML with the following structure:
\`\`\`yaml
name: "Test Name"
graph:
  info: "Description of the test"
  start: "action_abc12" # ID of the first node
  nodes:
    action_abc12: # IDs follow action_[a-z0-9]{5}
      title: "Action Title"
      info: "Description of the action"
      next: "action_def34" # Next node ID (optional)
      config:
        visualCompare: true # optional: set to true to enforce visual regression check
\`\`\`
`.trim();

const SESSION_PROMPT = `
### Your Mission:
- Help users create, refactor, and understand Provar tests.
- When suggesting changes, provide YAML snippets or clear instructions.
- You can trigger the editor to select a file by including a JSON block: \`{ "action": { "type": "selectFile", "path": ".provar/tests/..." } }\` in your response.
- Be concise and technical.
- Format your response using only basic markdown formatting (headers, lists, inline code, code blocks, bold, and italic text).
- STRICTLY avoid tables, HTML tags, or complex markdown formats.
`.trim();

export const assistEditor = async ({
  prompt,
  path,
  onChunk,
}: {
  prompt: string;
  path?: string;
  onChunk?: (text: string, status: "pending" | "completed" | "error") => void;
}) => {
  const { config } = await getConfig();

  if (!config) {
    return {
      message:
        "Provar configuration not found. Please create a .provar/config.yml file.",
    };
  }

  const providerName = config.provider.name as "gemini-cli" | "copilot-cli";

  // Initialize or re-initialize provider if config changed
  if (!activeClient || activeProviderName !== providerName) {
    if (activeClient) {
      await activeClient.close();
    }
    try {
      activeClient = createClient(providerName, {
        workspaceDir: WORKSPACE_DIR,
      });
      activeProviderName = providerName;
      activeSession = null;
    } catch (err: any) {
      return {
        message: `AI Provider "${providerName}" is not supported. Please check your project settings. Error: ${err.message}`,
      };
    }
  }

  try {
    if (!activeSession) {
      activeSession = await activeClient.session();

      // Seed the session with the system prompt and session rules
      let seedPrompt = PROVAR_SYSTEM_PROMPT;
      if (SESSION_PROMPT) {
        seedPrompt += `\n\n${SESSION_PROMPT}`;
      }

      for await (const _ of activeSession.prompt([
        { type: "text", text: seedPrompt },
      ])) {
        // Consume seed prompt stream
      }
    }

    let finalPrompt = prompt;

    // Include file context if available
    if (path) {
      try {
        const fileContent = await readFile(getAbsPath(path), "utf-8");
        finalPrompt = `Context File (${path}):\n${fileContent}\n\n${prompt}`;
      } catch (e) {
        console.error(`[AI Assistant] Failed to read context file: ${path}`, e);
      }
    }

    const chunks: string[] = [];
    for await (const chunk of activeSession.prompt([
      { type: "text", text: finalPrompt },
    ])) {
      if (chunk.type === "text" && chunk.text) {
        chunks.push(chunk.text);
        onChunk?.(chunk.text, "pending");
      }
    }

    const aiText = chunks.join("");

    // Extract action if present in the text
    let action: any = undefined;
    const actionMatch = aiText.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (actionMatch) {
      try {
        const actionData = JSON.parse(actionMatch[0]);
        action = actionData.action;
      } catch (e) {
        console.error(
          "[AI Assistant] Failed to parse action from AI response",
          e,
        );
      }
    }

    onChunk?.("", "completed");

    return {
      message: aiText,
      action,
    };
  } catch (e: any) {
    console.error("[AI Assistant] Error calling AI Provider:", e);
    const errorMsg = `Failed to communicate with the AI Assistant (${providerName}): ${e.message || "Unknown error"}`;
    onChunk?.(errorMsg, "error");
    return {
      message: errorMsg,
    };
  } finally {
    triggerWorkspaceChanged();
  }
};
