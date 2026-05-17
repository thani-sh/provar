import type { AIProvider } from './types';
import { GeminiCLIProvider } from './providers/gemini-cli';

const providers: Record<string, AIProvider> = {
	'gemini-cli': new GeminiCLIProvider()
};

export const getAIProvider = (name: string): AIProvider | null => {
	return providers[name] || null;
};

export const getAvailableProviders = (): string[] => {
	return Object.keys(providers);
};
