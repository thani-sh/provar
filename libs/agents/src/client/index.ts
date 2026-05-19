import { spawn, type Subprocess } from 'bun';
import * as acp from '@agentclientprotocol/sdk';
import { FSCapability } from './capabilities/fs';
import { PermissionHandler } from './permissionHandler';
import { OutputAdapter } from './outputAdapter';

export interface ACPClientOptions {
	workspaceDir: string;
}

export class ACPClient implements acp.Client {
	private process: Subprocess | null = null;
	private connection: acp.ClientSideConnection | null = null;
	private sessionBuffers = new Map<string, string>();
	private sessionLocks = new Map<string, Promise<void>>();
	private fs: FSCapability;
	private permissionHandler: PermissionHandler;

	constructor(
		private command: string[],
		private options: ACPClientOptions,
	) {
		this.fs = new FSCapability({ workspaceDir: options.workspaceDir });
		this.permissionHandler = new PermissionHandler({
			workspaceDir: options.workspaceDir,
		});
	}

	get isRunning() {
		return this.process !== null && this.connection !== null;
	}

	async start() {
		if (this.process) return;

		console.log(`[ACPClient] Starting process: ${this.command.join(' ')}`);
		this.process = spawn(this.command, {
			stdin: 'pipe',
			stdout: 'pipe',
			stderr: 'pipe',
		});

		// Handle process exit
		this.process.exited.then((code) => {
			console.log(`[ACPClient] Process exited with code ${code}`);
			this.cleanup();
		});

		// Handle stderr for debugging
		this.readStderr();

		const outputAdapter = new OutputAdapter(this.process);

		// Casting to unknown then to expected types due to Bun/ACP SDK type mismatch
		// Bun's stdin/stdout streams are compatible at runtime but types differ slightly
		const stream = acp.ndJsonStream(
			outputAdapter as unknown as WritableStream,
			this.process.stdout as unknown as ReadableStream,
		);

		this.connection = new acp.ClientSideConnection((_agent) => this, stream);

		await this.connection.initialize({
			protocolVersion: acp.PROTOCOL_VERSION,
			clientInfo: {
				name: 'Provar Editor',
				version: '1.0.0',
			},
			clientCapabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			},
		});
	}

	private cleanup() {
		this.process = null;
		this.connection = null;
		this.sessionBuffers.clear();
		this.sessionLocks.clear();
	}

	async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
		return this.fs.readTextFile(params);
	}

	async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
		return this.fs.writeTextFile(params);
	}

	async requestPermission(
		params: acp.RequestPermissionRequest,
	): Promise<acp.RequestPermissionResponse> {
		return this.permissionHandler.requestPermission(params);
	}

	async sessionUpdate(params: acp.SessionNotification): Promise<void> {
		const buffer = this.sessionBuffers.get(params.sessionId);
		if (buffer === undefined) {
			return;
		}
		const update = params.update as any;
		if (update.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
			this.sessionBuffers.set(params.sessionId, buffer + update.content.text);
		} else if (update.type === 'agent_message_chunk' && update.text) {
			this.sessionBuffers.set(params.sessionId, buffer + update.text);
		}
	}

	async createSession(): Promise<string> {
		if (!this.connection) {
			throw new Error('Client not started or process crashed');
		}
		const result = await this.connection.newSession({
			cwd: this.options.workspaceDir,
			mcpServers: [],
		});
		this.sessionBuffers.set(result.sessionId, '');
		return result.sessionId;
	}

	async loadSession(sessionId: string): Promise<void> {
		if (!this.connection) {
			throw new Error('Client not started or process crashed');
		}
		await this.connection.loadSession({
			sessionId,
			cwd: this.options.workspaceDir,
			mcpServers: [],
		});
		this.sessionBuffers.set(sessionId, '');
	}

	async prompt(
		sessionId: string,
		prompt: acp.ContentBlock[],
	): Promise<{ message: string; sessionId: string }> {
		if (!this.connection) {
			throw new Error('Client not started or process crashed');
		}

		// Ensure only one prompt is active per session to avoid buffer corruption
		const currentLock = this.sessionLocks.get(sessionId) || Promise.resolve();
		const nextLock = currentLock.then(async () => {
			this.sessionBuffers.set(sessionId, '');
			await this.connection!.prompt({ sessionId, prompt });
		});

		this.sessionLocks.set(sessionId, nextLock);
		await nextLock;

		return {
			message: this.sessionBuffers.get(sessionId) || '',
			sessionId,
		};
	}

	private async readStderr() {
		if (!this.process?.stderr) return;
		const reader = (this.process.stderr as any).getReader();

		const decoder = new TextDecoder();
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				const text = decoder.decode(value);
				if (text.trim()) {
					console.error(`[ACPClient Debug] ${text.trim()}`);
				}
			}
		} catch (e) {
			console.error('[ACPClient] Error reading stderr:', e);
		}
	}

	async stop() {
		if (this.process) {
			this.process.kill();
		}
		this.cleanup();
	}
}
