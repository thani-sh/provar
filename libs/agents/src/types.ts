export type Attachment =
  | { type: "text"; text: string }
  | { type: "code"; code: string; language?: string }
  | { type: "image"; data: string | Buffer; mimeType: string };

export type Message = {
  role: "user" | "assistant" | "system";
  content: string | Attachment[];
};

export interface Session {
  id: string;
  prompt(messages: Message[]): AsyncGenerator<Attachment, void>;
}

export interface Client {
  session(options?: { tools?: Record<string, any> }): Promise<Session>;
  close(): Promise<void>;
}
