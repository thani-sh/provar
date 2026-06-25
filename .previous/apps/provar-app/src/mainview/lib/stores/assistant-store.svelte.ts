import { ProvarAPI } from "../api/provar";
import { editorStore } from "./editor-store.svelte";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "completed" | "error";
};

/**
 * AssistantStore owns the AI assistant conversation state and the streaming
 * send logic. The panel component reads from this store and renders the
 * message list — keeping the view dumb and the streaming concerns out of
 * App.svelte.
 */
class AssistantStore {
  messages = $state<AssistantMessage[]>([]);
  isBusy = $state(false);

  /**
   * send kicks off an editor-assist request, appends a user + assistant
   * message pair, and streams the assistant response chunk-by-chunk.
   */
  async send(prompt: string): Promise<void> {
    if (this.isBusy) return;

    // Capture conversation history prior to this turn
    const history = this.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantMsgId = newMessageId();
    this.messages = [
      ...this.messages,
      {
        id: newMessageId(),
        role: "user",
        content: prompt,
        status: "completed",
      },
      { id: assistantMsgId, role: "assistant", content: "", status: "pending" },
    ];

    this.isBusy = true;

    try {
      const stream = ProvarAPI.assistEditor(
        prompt,
        history,
        editorStore.selectedFilePath || undefined,
      );

      let fullResponseText = "";
      for await (const chunk of stream) {
        fullResponseText += chunk.text;
        this.messages = this.messages.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: fullResponseText, status: chunk.status }
            : msg,
        );
      }
    } catch (e) {
      console.error("AssistantStore: AI Assist failed:", e);
      this.messages = this.messages.map((msg) =>
        msg.id === assistantMsgId
          ? {
              ...msg,
              content: "Sorry, I encountered an error. Please try again.",
              status: "error",
            }
          : msg,
      );
    } finally {
      this.isBusy = false;
    }
  }
}

function newMessageId(): string {
  return Math.random().toString(36).substring(7);
}

/**
 * assistantStore is the shared reactive state instance of AssistantStore.
 */
export const assistantStore = new AssistantStore();
