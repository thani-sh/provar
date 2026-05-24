# @libs/agents

A shared library for AI agent interactions, primarily supporting the [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/protocol).

## Key Features

- **ACP Compliance:** Implements standard client protocols for structured interaction with AI agents.
- **Provider Registry:** Centralized registry for resolving different agent backends.
- **Context-Aware Sessions:** Manages stateful conversation histories and prompts within automated workflows.

## Usage

### Using the Agent Provider Registry

The easiest way to get an agent provider is through the registry:

```typescript
import { getAgentProvider } from "@libs/agents";

const provider = getAgentProvider("gemini-cli", {
  systemPrompt: "You are a helpful assistant",
  workspaceDir: "/path/to/project"
});

if (provider) {
  const session = await provider.createSession({
    sessionPrompt: "Help me create a test for a login page"
  });

  const response = await session.prompt([
    { type: "text", text: "How do I start?" }
  ]);

  console.log(response[0].text);
}
```

## Extending the Library

To add a new agent provider:
1. Create a new file in `src/providers/`.
2. Implement the `AgentProvider` interface and a corresponding `Session` implementation.
3. Register the new provider in `src/registry.ts`.
4. Export the provider from `src/index.ts`.
