import { streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelMessage, LanguageModel } from "ai";
import type { Client, Session, Attachment, Message } from "../types";
import type { ModelSettings } from "@libs/settings";

function mapAttachment(a: Attachment) {
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
    const image = typeof a.data === "string" ? Buffer.from(a.data, "base64") : a.data;
    return {
      type: "image" as const,
      image,
      mimeType: a.mimeType,
    };
  }
  throw new Error(`Unsupported attachment type: ${(a as any).type}`);
}

export class AISDKSession implements Session {
  private messages: ModelMessage[] = [];

  constructor(
    public id: string,
    private model: LanguageModel,
    private tools?: Record<string, any>,
  ) {}

  async *prompt(stuff: Message[]): AsyncGenerator<Attachment, void> {
    if (stuff.length === 0) return;

    const addedMessagesCount = stuff.length;

    // Map and push the new conversation turns to our history
    for (const msg of stuff) {
      if (typeof msg.content === "string") {
        this.messages.push({
          role: msg.role as any,
          content: msg.content,
        });
      } else {
        const contentParts = msg.content.map(mapAttachment);
        this.messages.push({
          role: msg.role as any,
          content: contentParts as any,
        });
      }
    }

    const result = streamText({
      model: this.model,
      messages: this.messages,
      tools: this.tools,
      maxSteps: 5,
      stopWhen: stepCountIs(5),
    } as any);

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

export class AISDKClient implements Client {
  private model: LanguageModel;

  constructor(settings: ModelSettings) {
    this.model = resolveModel(settings);
  }

  async session(options?: { tools?: Record<string, any> }): Promise<Session> {
    return new AISDKSession(crypto.randomUUID(), this.model, options?.tools);
  }

  async close(): Promise<void> {
    // No persistent process to clean up
  }
}

function resolveModel(settings: ModelSettings): LanguageModel {
  const { defaultProvider, providers } = settings;

  if (defaultProvider === "openai") {
    const cfg = providers.openai;
    const client = createOpenAI({
      apiKey: cfg.apiKey || undefined,
      baseURL: cfg.baseUrl || undefined,
    });
    return client(cfg.model || "gpt-4o");
  }

  if (defaultProvider === "google-generative-ai") {
    const cfg = providers["google-generative-ai"];
    const client = createGoogleGenerativeAI({
      apiKey: cfg.apiKey || undefined,
    });
    return client(cfg.model || "gemini-1.5-flash");
  }

  throw new Error(`Unsupported provider: ${defaultProvider}`);
}

