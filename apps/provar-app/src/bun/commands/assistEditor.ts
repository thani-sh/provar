import { readFile } from "fs/promises";
import { getAbsPath, triggerWorkspaceChanged, WORKSPACE_DIR } from "../utils";
import { getConfig } from "./getConfig";
import {
  getAgentProvider,
  type AgentProvider,
  type Session,
} from "@libs/agents";

let activeProvider: AgentProvider | null = null;
let activeSession: Session | null = null;

const PROVAR_SYSTEM_PROMPT = `
You are the AI Assistant for Provar, a visual, graph-based end-to-end testing tool.
Provar represents tests as a directed graph of "actions" and "assertions".

### Testing Concepts:
- **Tests**: Top-level test files stored in ".provar/tests/*.test.yml".
- **Actions**: Individual steps in a test (e.g., loggin in).
- **Assertions**: Verification steps attached to actions.
- **Next**: Defines the flow from one action to the next (can be a single ID or an array for branching).

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
      asserts:
        assert_ghj56: # IDs follow assert_[a-z0-9]{5}
          title: "Assertion Title"
          info: "What to verify"
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

  // Initialize or re-initialize provider if config changed (simplified for now)
  if (!activeProvider || activeProvider.name !== config.provider.name) {
    if (activeProvider) {
      await activeProvider.stop();
    }
    activeProvider = getAgentProvider(config.provider.name, {
      systemPrompt: PROVAR_SYSTEM_PROMPT,
      workspaceDir: WORKSPACE_DIR,
    });
    activeSession = null;
  }

  if (!activeProvider) {
    return {
      message: `AI Provider "${config.provider.name}" is not supported. Please check your project settings.`,
    };
  }

  try {
    if (!activeSession) {
      activeSession = await activeProvider.createSession({
        sessionPrompt: SESSION_PROMPT,
      });
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

    // Extract action if present in the text (keeping legacy behavior)
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
    const errorMsg = `Failed to communicate with the AI Assistant (${config.provider.name}): ${e.message || "Unknown error"}`;
    onChunk?.(errorMsg, "error");
    return {
      message: errorMsg,
    };
  } finally {
    triggerWorkspaceChanged();
  }
};
