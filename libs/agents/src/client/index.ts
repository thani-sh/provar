import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelMessage, LanguageModel } from "ai";
import type { Client, Session, Attachment } from "../types";
import type { ModelSettings } from "@libs/settings";

export class AISDKSession implements Session {
  private messages: ModelMessage[] = [];

  constructor(
    public id: string,
    private model: LanguageModel,
  ) {}

  async *prompt(attachments: Attachment[]): AsyncGenerator<Attachment, void> {
    const userContent = attachments.map((a) => {
      if (a.type === "text") {
        return { type: "text" as const, text: a.text };
      }
      if (a.type === "code") {
        return {
          type: "text" as const,
          text: `\`\`\`${a.language ?? ""}\n${a.code}\n\`\`\``,
        };
      }
      return { type: "image" as const, image: a.data, mimeType: a.mimeType };
    });

    this.messages.push({ role: "user", content: userContent });

    const result = streamText({
      model: this.model,
      messages: this.messages,
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
      yield { type: "text", text: chunk };
    }

    this.messages.push({ role: "assistant", content: fullText });
  }
}

export class AISDKClient implements Client {
  private model: LanguageModel;

  constructor(settings: ModelSettings) {
    this.model = resolveModel(settings);
  }

  async session(): Promise<Session> {
    return new AISDKSession(crypto.randomUUID(), this.model);
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
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl || undefined,
    });
    return client(cfg.model || "gpt-4o");
  }

  if (defaultProvider === "google-generative-ai") {
    const cfg = providers["google-generative-ai"];
    const client = createGoogleGenerativeAI({
      apiKey: cfg.apiKey,
    });
    return client(cfg.model || "gemini-1.5-flash");
  }

  throw new Error(`Unsupported provider: ${defaultProvider}`);
}
