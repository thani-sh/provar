import { streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelMessage, LanguageModel, ToolSet } from "ai";
import type {
  Client,
  Session,
  Attachment,
  Message,
  AgentClientConfig,
} from "../types";

type MappedAttachment =
  | { type: "text"; text: string }
  | { type: "image"; image: Buffer; mimeType: string };

function mapAttachment(a: Attachment): MappedAttachment {
  if (a.type === "text") {
    return { type: "text" as const, text: a.text };
  }
  if (a.type === "code") {
    return {
      type: "text" as const,
      text: `\`\`\`${a.language ?? ""}\n${a.code}\n\`\`\``,
    };
  }
  if (a.type === "image") {
    const image =
      typeof a.data === "string" ? Buffer.from(a.data, "base64") : a.data;
    return {
      type: "image" as const,
      image,
      mimeType: a.mimeType,
    };
  }
  throw new Error(
    `Unsupported attachment type: ${(a as Record<string, unknown>).type}`,
  );
}

/**
 * @internal
 * Exposed for unit tests only — the AI SDK takes a different shape than
 * our `Attachment` union, and we want to pin the conversion contract.
 */
export const __test__ = { mapAttachment };

/**
 * AISDKSession implements an active conversation session using the Vercel AI SDK.
 */
export class AISDKSession implements Session {
  private messages: ModelMessage[] = [];

  constructor(
    public id: string,
    private model: LanguageModel,
    private tools?: ToolSet,
  ) {}

  async *prompt(stuff: Message[]): AsyncGenerator<Attachment, void> {
    if (stuff.length === 0) return;

    const addedMessagesCount = stuff.length;

    // Separate the system prompt from the conversation turns.
    // The AI SDK requires `system` to be passed as a top-level option
    // (not inside the `messages` array) to avoid prompt-injection warnings.
    const systemParts: string[] = [];
    const conversation: Message[] = [];

    for (const msg of stuff) {
      if (msg.role === "system") {
        // System content can be a plain string or a list of text attachments.
        if (typeof msg.content === "string") {
          systemParts.push(msg.content);
        } else {
          for (const part of msg.content) {
            if (part.type === "text") systemParts.push(part.text);
          }
        }
      } else {
        conversation.push(msg);
      }
    }

    const systemPrompt =
      systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

    // Map and push the new conversation turns to our history
    for (const msg of conversation) {
      if (typeof msg.content === "string") {
        this.messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      } else {
        const contentParts = msg.content.map(mapAttachment);
        this.messages.push({
          role: msg.role as "user" | "assistant",
          content: contentParts as unknown as string,
        });
      }
    }

    const result = streamText({
      model: this.model,
      system: systemPrompt,
      messages: this.messages,
      tools: this.tools,
      stopWhen: stepCountIs(5),
    });

    let fullText = "";
    try {
      for await (const chunk of result.textStream) {
        fullText += chunk;
        yield { type: "text", text: chunk };
      }
      this.messages.push({ role: "assistant", content: fullText });
    } catch (err) {
      // Clean up failed state: remove the messages added in this prompt run
      for (let i = 0; i < addedMessagesCount; i++) {
        this.messages.pop();
      }
      throw err;
    }
  }
}

/**
 * AISDKClient manages the LLM provider mapping and session instantiation.
 */
export class AISDKClient implements Client {
  private model: LanguageModel;

  constructor(config: AgentClientConfig) {
    this.model = resolveModel(config);
  }

  async session(options?: { tools?: ToolSet }): Promise<Session> {
    return new AISDKSession(crypto.randomUUID(), this.model, options?.tools);
  }

  async close(): Promise<void> {
    // No persistent process to clean up
  }
}

function resolveModel(config: AgentClientConfig): LanguageModel {
  const { provider, apiKey, model, baseUrl } = config;

  if (provider === "openai") {
    const client = createOpenAI({
      apiKey: apiKey || undefined,
      baseURL: baseUrl || undefined,
    });
    return client(model || "gpt-4o");
  }

  if (provider === "google-generative-ai") {
    const client = createGoogleGenerativeAI({
      apiKey: apiKey || undefined,
    });
    return client(model || "gemini-1.5-flash");
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
