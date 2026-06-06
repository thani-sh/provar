# 011 - Modular Shared Libraries Architecture

## Context

As the Provar codebase matures, the responsibilities of test definition, code compilation, workspace loading, and test execution must be decoupled. Mixing execution dependencies with compilation output or hardcoding runtime library wrappers into compiled files makes it difficult to maintain and scale. We need a well-defined, modular architecture with clear library boundaries to support different agent providers, strict domain validation, dynamic file loading, and precise run execution control.

## Decision

We will implement a modular shared library architecture under `@libs/` and decouple compiled code from runtime execution metadata.

### 1. Library Modularity and Boundaries

The codebase is split into the following specialized packages:

- **`@libs/models`**: Handles client orchestration. It defines a protocol-agnostic client factory (`createClient`) and standard interfaces (`Client`, `Session`, `Attachment`) to communicate with provider models.
- **`@libs/domain`**: Establishes core data structures and graph models (`Project`, `Graph`, `File`, `Path`, `Task`). All structures are validated using Zod schemas prefixed with `schemaFor` and exported from `@libs/domain/zod`. Pre-processing transparently coerces singular task links (`next`) into arrays.
- **`@libs/engine`**: Unified workspace loading, compilation, and browser execution engine. It crawls workspaces, parses YAML, generates task interaction code via AI models, and executes tests step-by-step using Playwright.

### 2. Decoupled Code Generation

The `@libs/engine` produces a clean, runtime-decoupled `.test.ts` file. It serves strictly as a flat repository of compiled tasks and linear execution paths:

```ts
// hash: <yml-file-sha-hash>
import type { TestAPI } from "@libs/engine";

export const tasks = {
   ['<task-id-1>']: async (api: TestAPI) => {
      // Compiled code
   },
};

export const paths = [
   ['<task-id-1>'],
];
```

At runtime, the engine reads both the declarative `.test.yml` (for structural metadata) and the `.test.ts` module (for executable functions) to construct the runnable graph.

## Consequences

- **Decoupled Architecture**: Separation of concerns isolates compilation logic, execution machinery, and model validation, reducing the likelihood of cross-layer bugs.
- **Type Safety**: Centralized Zod validation ensures that all tools and interfaces work with validated, coerced structures.
- **Clean Generated Code**: `.test.ts` files remain free of runtime scaffolding, simplifying manual inspection, debugging, and git-diff tracking.
- **Controlled Test Execution**: The event-driven runner enables real-time progress monitoring, pause/resume mechanisms, and safe cleanup.
