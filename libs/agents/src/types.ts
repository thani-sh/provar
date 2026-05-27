export type Attachment =
  | { type: "text"; text: string }
  | { type: "code"; code: string; language?: string }
  | { type: "image"; data: string; mimeType: string };

export interface Session {
  id: string;
  prompt(stuff: Attachment[]): AsyncGenerator<Attachment, void>;
}

export interface Client {
  session(): Promise<Session>;
  close(): Promise<void>;
}
