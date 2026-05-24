# @libs/domain

A shared library providing the core domain models, schema definitions, and TypeScript interfaces for the Provar monorepo.

## Key Features

- **Schema Validation:** Comprehensive Zod schemas for configurations and visual test graphs.
- **Unified TypeScript Types:** Inferred types like `Config`, `GraphNode`, and `TestGraph` to ensure safety across apps.
- **Configuration Parsing:** Standardized structure definitions for variables, providers, and test executions.

## Usage

```typescript
import { ConfigSchema } from "@libs/domain";
import type { Config } from "@libs/domain";

// Example parsing and validation
const configData: Config = ConfigSchema.parse({
  provider: {
    name: "gemini-cli"
  },
  variables: {
    BASE_URL: "http://localhost:6001"
  }
});
```
