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
			await session.prompt([{ type: 'text', text: initialPrompt }]);
		}

		return session;
	}

	async prompt(sessionId: string, stuff: Attachment[]): Promise<Attachment[]> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}
		return session.prompt(stuff);
	}

	async stop(): Promise<void> {
		if (this.client) {
			await this.client.stop();
			this.client = null;
		}
		this.sessions.clear();
	}
}
