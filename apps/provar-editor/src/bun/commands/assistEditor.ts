import { readFile } from 'fs/promises';
import { getAbsPath, triggerWorkspaceChanged } from '../utils';
import { getConfig } from './getConfig';
import { getAIProvider } from '../ai/registry';

let currentSessionId: string | null = null;

const PROVAR_BASE_PROMPT = `
You are the AI Assistant for Provar, a visual, graph-based end-to-end testing tool.
Provar represents tests as a directed graph of "actions" and "assertions".

### Testing Concepts:
- **Tests**: Top-level test files stored in ".provar/tests/*.test.yml".
- **Actions**: Individual steps in a test (e.g., loggin in).
- **Assertions**: Verification steps attached to actions.
- **Next**: Defines the flow from one action to the next (can be a single ID or an array for branching).

### YAML Schema:
Tests use YAML with the following structure:
\`\`\`yaml
name: "Test Name"
graph:
  info: "Description of the test"
  start: "action_abc12" # ID of the first node
  nodes:
    action_abc12: # IDs follow action_[a-z0-9]{5}
      title: "Action Title"
      info: "Description of the action"
      next: "action_def34" # Next node ID (optional)
      asserts:
        assert_ghj56: # IDs follow assert_[a-z0-9]{5}
          title: "Assertion Title"
          info: "What to verify"
\`\`\`

### Your Mission:
- Help users create, refactor, and understand Provar tests.
- When suggesting changes, provide YAML snippets or clear instructions.
- You can trigger the editor to select a file by including a JSON block: \`{ "action": { "type": "selectFile", "path": ".provar/tests/..." } }\` in your response.
- Be concise and technical.
`.trim();

export const assistEditor = async ({ prompt, path }: { prompt: string; path?: string }) => {
	const { config } = await getConfig();

	if (!config) {
		return {
			message: 'Provar configuration not found. Please create a .provar/config.yml file.'
		};
	}

	const provider = getAIProvider(config.provider.name);

	if (!provider) {
		return {
			message: `AI Provider "${config.provider.name}" is not supported. Please check your project settings.`
		};
	}

	try {
		let contextFile: { path: string; content: string } | undefined = undefined;

		// Include file context if available
		if (path) {
			try {
				const fileContent = await readFile(getAbsPath(path), 'utf-8');
				contextFile = { path, content: fileContent };
			} catch (e) {
				console.error(`[AI Assistant] Failed to read context file: ${path}`, e);
			}
		}

		const response = await provider.assist({
			prompt,
			basePrompt: PROVAR_BASE_PROMPT,
			contextFile,
			sessionId: currentSessionId,
			config: config.provider
		});

		if (response.sessionId) {
			currentSessionId = response.sessionId;
		}

		return {
			message: response.message,
			action: response.action
		};
	} catch (e: any) {
		console.error('[AI Assistant] Error calling AI Provider:', e);
		return {
			message: `Failed to communicate with the AI Assistant (${config.provider.name}): ${e.message || 'Unknown error'}`
		};
	} finally {
		triggerWorkspaceChanged();
	}
};
