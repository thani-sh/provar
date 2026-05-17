import { spawn } from 'bun';
import { WORKSPACE_DIR } from '../../utils';
import type { AIProvider, AIResponse } from '../types';

export class GeminiCLIProvider implements AIProvider {
	name = 'gemini-cli';

	async assist({
		prompt,
		basePrompt,
		contextFile,
		sessionId,
	}: {
		prompt: string;
		basePrompt: string;
		contextFile?: { path: string; content: string };
		sessionId?: string | null;
	}): Promise<AIResponse> {
		let fullPrompt = prompt;

		// If it's a new session, prepend the base prompt
		if (!sessionId) {
			fullPrompt = `${basePrompt}\n\nUser request: ${prompt}`;
		}

		// Include file context if available
		if (contextFile) {
			fullPrompt = `Context File (${contextFile.path}):\n${contextFile.content}\n\n${fullPrompt}`;
		}

		const args = ['gemini', '--output-format', 'json', '--approval-mode', 'auto_edit'];

		if (WORKSPACE_DIR) {
			args.push('--include-directories', WORKSPACE_DIR);
		}

		if (sessionId) {
			args.push('-r', sessionId);
		}

		args.push('-p', fullPrompt);

		console.log(`[GeminiCLIProvider] Executing: ${args.join(' ')}`);

		const process = spawn(args, {
			stdout: 'pipe',
			stderr: 'pipe'
		});

		const response = await new Response(process.stdout).text();
		const errorOutput = await new Response(process.stderr).text();

		if (errorOutput) {
			console.error(`[GeminiCLIProvider] CLI Error Output: ${errorOutput}`);
		}

		if (!response.trim()) {
			throw new Error('Empty response from AI CLI');
		}

		const jsonResponse = JSON.parse(response);
		const aiText = jsonResponse.response || '';
		const newSessionId = jsonResponse.session_id;

		// Extract action if present in the text
		let action: any = undefined;
		const actionMatch = aiText.match(/\{[\s\S]*"action"[\s\S]*\}/);
		if (actionMatch) {
			try {
				const actionData = JSON.parse(actionMatch[0]);
				action = actionData.action;
			} catch (e) {
				console.error('[GeminiCLIProvider] Failed to parse action from AI response', e);
			}
		}

		return {
			message: aiText,
			action,
			sessionId: newSessionId
		};
	}
}
