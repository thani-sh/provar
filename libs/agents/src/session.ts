import { ACPClient } from "./client";
import type { Attachment, Session } from "./types";

export class ACPSession implements Session {
  constructor(
    public id: string,
    private client: ACPClient,
  ) {}

  async *prompt(stuff: Attachment[]): AsyncGenerator<Attachment, void> {
    for await (const chunk of this.client.promptStream(this.id, stuff)) {
      yield chunk;
    }
  }
}
