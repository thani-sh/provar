import { ACPClient } from "../acp";
import { WORKSPACE_DIR } from "../../utils";
import type { AIProvider, AIResponse } from "../types";

export class GeminiCLIProvider implements AIProvider {
  name = "gemini-cli";

  async assist({
    prompt,
    basePrompt,
    contextFile,
    sessionId,
  }: {
    prompt: string;
    basePrompt: string;
    contextFile?: { path: string; content: string };
    sessionId?: string | null;
  }): Promise<AIResponse> {
    const args = ["gemini", "--acp"];

    const client = new ACPClient(args, {
      name: "Provar Editor",
      version: "1.0.0",
    });

    try {
      await client.start();

      // Handle session
      let currentSessionId = sessionId;
      if (currentSessionId) {
        try {
          await client.loadSession(currentSessionId);
        } catch (e) {
          console.warn(
            `[GeminiCLIProvider] Failed to load session ${currentSessionId}, creating new one`,
            e,
          );
          currentSessionId = await client.createSession();
        }
      } else {
        currentSessionId = await client.createSession();
      }

      // Prepend base prompt for new sessions
      let finalPrompt = prompt;
      if (!sessionId) {
        finalPrompt = `${basePrompt}\n\nUser request: ${prompt}`;
      }

      // Include file context if available (though ACP handles this better via FS Proxy)
      if (contextFile) {
        finalPrompt = `Context File (${contextFile.path}):\n${contextFile.content}\n\n${finalPrompt}`;
      }

      const result = await client.prompt(finalPrompt);

      const aiText = result.message || "";
      const newSessionId = result.sessionId || currentSessionId;

      // Extract action if present in the text (keeping legacy behavior)
      let action: any = undefined;
      const actionMatch = aiText.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[0]);
          action = actionData.action;
        } catch (e) {
          console.error(
            "[GeminiCLIProvider] Failed to parse action from AI response",
            e,
          );
        }
      }

      return {
        message: aiText,
        action,
        sessionId: newSessionId,
      };
    } finally {
      await client.stop();
    }
  }
}
