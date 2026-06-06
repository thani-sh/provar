# 013 - Use Vercel AI SDK for LLM Calls

## Context

Previously, `@libs/agents` used the Agent Client Protocol (ACP) and spawned a local subprocess of the Gemini CLI (`gemini --acp`). While this decoupled the provider implementation from the library, it introduced several issues:

1. It required users to have the Gemini CLI installed locally.
2. ACP is not widely adopted for many LLM providers.

We need a unified, lightweight way to interact with LLM providers directly from the main process, using the user's saved settings.

## Decision

We will migrate `@libs/models` to use the Vercel AI SDK (`ai`, `@ai-sdk/openai`, and `@ai-sdk/google`) to call LLM APIs directly.

Specifically:

1. We will replace `ACPClient`, `GeminiCLIClient`, and all ACP-related capability files with `AISDKClient` and `AISDKSession`.
2. The `createClient()` function will accept `ModelSettings` (from `@libs/config`) to initialize the appropriate provider.
3. `AISDKSession` will preserve conversation history by keeping an internal `ModelMessage[]` array and appending turns on each `prompt()` call.

## Consequences

- Users do not need to install the Gemini CLI.
- LLM API keys and model configurations set in the UI Settings modal are fully respected.
- Less code complexity and fewer subprocesses, improving stability.
- Conversation history is managed statefully at the session level.
