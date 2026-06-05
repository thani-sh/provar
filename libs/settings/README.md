# @libs/settings

Shared library for managing global Provar application settings. Provides the Zod schema, TypeScript types, and file-system helpers to read and write settings.

## Storage location

Settings are stored at `~/.provar/settings.json`. The directory is created automatically on first write.

## Usage

```ts
import { loadSettings, saveSettings, type Settings } from "@libs/settings";

// Read
const settings = loadSettings();
console.log(settings.models.defaultProvider); // "google-generative-ai"

// Write (deep merge with current values)
saveSettings({
  models: {
    defaultProvider: "openai",
    providers: {
      openai: { apiKey: "sk-...", model: "gpt-4o", baseUrl: "" },
      "google-generative-ai": { apiKey: "", model: "gemini-1.5-flash" },
    },
  },
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
| `recentWorkspaces` | `string[]` | `[]` |
