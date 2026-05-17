export interface AISuggestedAction {
	type: string;
	[key: string]: any;
}

export interface AIResponse {
	message: string;
	action?: AISuggestedAction;
	sessionId?: string;
}

export interface AIProvider {
	name: string;
	assist(params: {
		prompt: string;
		basePrompt: string;
		contextFile?: {
			path: string;
			content: string;
		};
		sessionId?: string | null;
	}): Promise<AIResponse>;
}
