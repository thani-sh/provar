import * as acp from '@agentclientprotocol/sdk';

export type Attachment = acp.ContentBlock;

export interface Session {
	id: string;
	prompt(stuff: Attachment[]): AsyncGenerator<Attachment, void>;
}

export interface AgentProvider {
	name: string;
	start(): Promise<void>;
	createSession(params: { sessionPrompt?: string }): Promise<Session>;
	prompt(sessionId: string, stuff: Attachment[]): AsyncGenerator<Attachment, void>;
	stop(): Promise<void>;
}
