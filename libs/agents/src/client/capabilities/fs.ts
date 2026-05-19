import { readFile, writeFile } from 'fs/promises';
import * as acp from '@agentclientprotocol/sdk';
import { join, isAbsolute, relative } from 'path';

export interface FSCapabilityOptions {
	workspaceDir: string;
}

export class FSCapability {
	constructor(private options: FSCapabilityOptions) {}

	private getAbsPath(path: string) {
		const absPath = isAbsolute(path) ? path : join(this.options.workspaceDir, path);

		const relPath = relative(this.options.workspaceDir, absPath);

		if (relPath.startsWith('..') || isAbsolute(relPath)) {
			throw new Error(`Path ${path} is outside of workspace directory`);
		}

		return absPath;
	}

	async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
		console.log(`[ACPClient] fs/read: ${params.path}`);
		const content = await readFile(this.getAbsPath(params.path), 'utf-8');
		return { content };
	}

	async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
		console.log(`[ACPClient] fs/write: ${params.path}`);
		await writeFile(this.getAbsPath(params.path), params.content, 'utf-8');
		return {};
	}
}
