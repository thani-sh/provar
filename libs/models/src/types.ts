/**
 * Attachment represents a media component (text, code, or image) sent to or received from the AI model.
 */
export type Attachment =
  | { type: "text"; text: string }
  | { type: "code"; code: string; language?: string }
  | { type: "image"; data: string | Buffer; mimeType: string };

/**
 * Message represents a single chat turn in the conversation with the AI model.
 */
export type Message = {
  role: "user" | "assistant" | "system";
  content: string | Attachment[];
};

/**
 * Session defines the interface for an ongoing prompt session with the AI agent.
 */
export interface Session {
  id: string;
  prompt(messages: Message[]): AsyncGenerator<Attachment, void>;
}

/**
 * Client represents the AI model client capable of starting sessions.
 */
export interface Client {
  session(options?: { tools?: Record<string, unknown> }): Promise<Session>;
  close(): Promise<void>;
}

/**
 * AgentClientConfig contains credential and provider selection configuration for the AI client.
 */
export interface AgentClientConfig {
  provider: "openai" | "google-generative-ai" | "minimax";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
