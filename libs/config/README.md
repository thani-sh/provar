# @libs/config

Shared library for managing global Provar application settings. Provides the Zod schema, TypeScript types, and file-system helpers to read and write settings.

## Storage location

Settings are stored at `~/.provar/settings.json`. The directory is created automatically on first write.

## Key Features

- **Global Config Schema:** Zod-backed validation for user settings, LLM provider API credentials, and recent projects.
- **Persistent Storage:** Simple file-system reading and deep-merging updates.
- **Architectural Boundary:** Strictly consumed by the application layer (`apps/provar-app` and `apps/provar-cli`) to read settings. It is never directly imported by lower-level libraries like `@libs/models` or `@libs/engine`.

## Usage

```ts
import { loadSettings, saveSettings, type Settings } from "@libs/config";

// Read
const settings = loadSettings();
console.log(settings.models.defaultProvider); // "google-generative-ai"

// Write (deep merge with current values)
saveSettings({
  recentProjects: ["/Users/user/Projects/my-provar-project"],
});
```

## Schema

| Field | Type | Default |
|---|---|---|
| `placeholder` | `string` | `"placeholder-value"` |
| `models.defaultProvider` | `"openai" \| "google-generative-ai"` | `"google-generative-ai"` |
| `models.providers.openai.apiKey` | `string` | `""` |
| `models.providers.openai.model` | `string` | `"gpt-4o"` |
| `models.providers.openai.baseUrl` | `string` | `""` |
| `models.providers["google-generative-ai"].apiKey` | `string` | `""` |
| `models.providers["google-generative-ai"].model` | `string` | `"gemini-1.5-flash"` |
| `recentProjects` | `string[]` | `[]` |
