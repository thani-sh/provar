import { spawn } from "bun";
import { readFile } from "fs/promises";
import { getAbsPath, WORKSPACE_DIR, triggerWorkspaceChanged } from "../utils";
import { getConfig } from "./getConfig";

let currentSessionId: string | null = null;

const PROVAR_BASE_PROMPT = `
You are the AI Assistant for Provar, a visual, graph-based end-to-end testing tool.
Provar represents tests as a directed graph of "actions" and "assertions".

### Testing Concepts:
- **Suites**: Top-level test files stored in ".provar/suites/*.spec.yml".
- **Nodes**: Reusable test steps stored in ".provar/nodes/*.node.yml".
- **Actions**: Individual steps in a test (e.g., clicking a button, entering text).
- **Assertions**: Verification steps attached to actions.
- **Next**: Defines the flow from one action to the next (can be a single ID or an array for branching).

### YAML Schema:
Tests use YAML with the following structure:
\`\`\`yaml
name: "Suite Name"
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

### Your Mission:
- Help users create, refactor, and understand Provar tests.
- When suggesting changes, provide YAML snippets or clear instructions.
- You can trigger the editor to select a file by including a JSON block: \`{ "action": { "type": "selectFile", "path": ".provar/suites/..." } }\` in your response.
- Be concise and technical.
`.trim();

export const assistEditor = async ({ prompt, path }: { prompt: string; path?: string }) => {
    const { config } = await getConfig();

    if (!config || config.provider.name !== 'gemini-cli') {
        return {
            message: "AI Provider not configured or not supported for this action. Please check your project settings."
        };
    }

    try {
        let fullPrompt = prompt;

        // If it's a new session, prepend the base prompt
        if (!currentSessionId) {
            fullPrompt = `${PROVAR_BASE_PROMPT}\n\nUser request: ${prompt}`;
        }

        // Include file context if available
        if (path) {
            try {
                const fileContent = await readFile(getAbsPath(path), "utf-8");
                fullPrompt = `Context File (${path}):\n${fileContent}\n\n${fullPrompt}`;
            } catch (e) {
                console.error(`[AI Assistant] Failed to read context file: ${path}`, e);
            }
        }

        const args = ["gemini", "--output-format", "json", "--approval-mode", "auto_edit"];

        if (WORKSPACE_DIR) {
            args.push("--include-directories", WORKSPACE_DIR);
        }

        if (currentSessionId) {
            args.push("-r", currentSessionId);
        }

        args.push("-p", fullPrompt);

        console.log(`[AI Assistant] Executing: ${args.join(" ")}`);

        const process = spawn(args, {
            stdout: "pipe",
            stderr: "pipe"
        });

        const response = await new Response(process.stdout).text();
        const errorOutput = await new Response(process.stderr).text();

        if (errorOutput) {
            console.error(`[AI Assistant] CLI Error Output: ${errorOutput}`);
        }

        try {
            if (!response.trim()) {
                throw new Error("Empty response from AI CLI");
            }
            const jsonResponse = JSON.parse(response);

            if (jsonResponse.session_id) {
                currentSessionId = jsonResponse.session_id;
            }

            const aiText = jsonResponse.response || "";

            // Extract action if present in the text
            let action: any = undefined;
            const actionMatch = aiText.match(/\{[\s\S]*"action"[\s\S]*\}/);
            if (actionMatch) {
                try {
                    const actionData = JSON.parse(actionMatch[0]);
                    action = actionData.action;
                } catch (e) {
                    console.error("[AI Assistant] Failed to parse action from AI response", e);
                }
            }

            return {
                message: aiText,
                action
            };
        } catch (e) {
            console.error("[AI Assistant] Failed to parse CLI response as JSON:", response);
            return {
                message: "Received an invalid response from the AI CLI. Please try again."
            };
        }

    } catch (e) {
        console.error("[AI Assistant] Error calling AI CLI:", e);
        return {
            message: "Failed to communicate with the AI Assistant. Make sure 'gemini' CLI is installed and in your PATH."
        };
    } finally {
        triggerWorkspaceChanged();
    }
};
