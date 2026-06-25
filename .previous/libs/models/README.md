# @libs/models

A shared library for AI agent orchestration, model client initialization, and streaming LLM sessions.

## Key Features

- **Vercel AI SDK Integration:** Interacts directly with AI providers (`google-generative-ai` and `openai`) using the Vercel AI SDK.
- **Generic Configs:** Exposes a provider-agnostic `AgentClientConfig` interface, removing direct dependencies on database/user settings schemas.
- **Context-Aware Sessions:** Manages stateful conversation histories (`AISDKSession`) and prompts within automated workflows.
- **Command-to-Tool Mapping:** Utilities to convert filesystem commands into structured AI-runnable tools (`convertCommandsToTools`).

## Usage

### 1. Creating a Client and Session

Callers initialize the client by mapping settings into an `AgentClientConfig` object:

```typescript
import { createClient } from "@libs/models";

const client = createClient({
  provider: "google-generative-ai",
  apiKey: "AIzaSy...",
  model: "gemini-1.5-flash"
});

const session = await client.session();

const responseGenerator = session.prompt([
  { role: "user", content: "How do I click a button in Playwright?" }
]);

for await (const chunk of responseGenerator) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.text);
  }
}

await client.close();
```

### 2. Exposing Commands as AI Tools

Expose project commands to the agent:

```typescript
import { createClient, convertCommandsToTools } from "@libs/models";

// commands is a record of CommandInterface classes
const tools = convertCommandsToTools(commands);

const client = createClient({ provider: "openai", apiKey: "sk-..." });
const session = await client.session({ tools });
```
