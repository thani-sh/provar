import { ACPClient } from '../client';
import { ACPSession } from '../session';
import type { AgentProvider, Attachment, Session } from '../types';

export class GeminiCLIProvider implements AgentProvider {
	name = 'gemini-cli';
	private systemPrompt: string;
	private sessions: Map<string, Session> = new Map();
	private client: ACPClient | null = null;
	private workspaceDir: string;

	constructor(params: { systemPrompt: string; workspaceDir: string }) {
		this.systemPrompt = params.systemPrompt;
		this.workspaceDir = params.workspaceDir;
	}

	async start(): Promise<void> {
		if (this.client?.isRunning) return;

		this.client = new ACPClient(['gemini', '--acp'], {
			workspaceDir: this.workspaceDir,
		});

		await this.client.start();
	}

	async createSession(params: { sessionPrompt?: string }): Promise<Session> {
		if (!this.client?.isRunning) {
			this.client = null;
			await this.start();
		}

		if (!this.client) throw new Error('Failed to start client');

		const sessionId = await this.client.createSession();
		const session = new ACPSession(sessionId, this.client);
		this.sessions.set(sessionId, session);

		// If there's a system prompt or session prompt, send it as the first message
		let initialPrompt = this.systemPrompt;
		if (params.sessionPrompt) {
			initialPrompt += `\n\n${params.sessionPrompt}`;
		}

		if (initialPrompt) {
			for await (const _ of session.prompt([{ type: 'text', text: initialPrompt }])) {
				// Consume initial prompt setup stream
			}
		}

		return session;
	}

	async *prompt(sessionId: string, stuff: Attachment[]): AsyncGenerator<Attachment, void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}
		for await (const chunk of session.prompt(stuff)) {
			yield chunk;
		}
	}

	async stop(): Promise<void> {
		if (this.client) {
			await this.client.stop();
			this.client = null;
		}
		this.sessions.clear();
	}
}
