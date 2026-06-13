# 012 - Centralized Command Library

## Context

The Provar desktop application (`@apps/provar-app`) currently implements filesystem and configuration capabilities (such as reading, creating, updating, and deleting test YAML files/folders, and reading/writing configuration files) within its own project boundaries. To enable AI agents to perform these actions autonomously via tool calls, these capabilities must be decoupled from the UI/desktop runtime, structured under a consistent command pattern, and placed in a shared library.

In addition, the data schemas representing the raw serialized formats of test files and project configuration currently reside in the application source (`apps/provar-app/src/shared/domain.ts`). These must be moved to the core `@libs/domain` library to establish a single source of truth for both raw serialized and runtime representations, keeping the codebase DRY.

## Decision

We will implement a centralized `@libs/commands` library and refactor the raw serialization domain schemas into `@libs/domain`.

### 1. Centralized Command Library (`@libs/commands`)

We will define an abstract base class `Command` that implements a standardized interface for all filesystem and configuration operations:

```typescript
import { z } from "zod";

export interface CommandContext {
  projectDir: string;
  onProjectChanged?: () => void;
}

export abstract class Command<Input extends Record<string, any> = any, Output = any> {
  abstract readonly name: string;
  abstract readonly title: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType<Input>;
  abstract readonly outputSchema: z.ZodType<Output>;

  protected constructor(protected readonly context: CommandContext) {}

  abstract execute(input: Input): Promise<Output>;
}
```

The library will implement the following commands:
- `GetConfigCommand`: Reads the Provar configuration file (`.provar/config.yml`).
- `SaveConfigCommand`: Saves the Provar configuration file and ensures required directories exist.
- `ReadFileCommand`: Reads and validates a test YAML file.
- `WriteFileCommand`: Saves/updates a test YAML file.
- `CreateFileCommand`: Creates a test YAML file with a default starting graph.
- `CreateDirectoryCommand`: Creates a directory recursively.
- `DeletePathCommand`: Deletes a file or directory.
- `ListFilesCommand`: Scans for `.test.yml` files in the tests directory.

### 2. Domain Schema Refactoring

We will migrate the raw serialization schemas from the app project to `@libs/domain/zod` and reuse existing schema schemas (e.g. `schemaForTaskConfig`) where appropriate. 
We will delete `apps/provar-app/src/shared/domain.ts` and update all imports in the desktop application to resolve directly from `@libs/domain/zod`.

## Consequences

- **Decoupled Actions**: Filesystem operations are fully encapsulated and decoupled from Electron/Electrobun-specific details, allowing them to be run by AI agents, CLI runs, or the desktop UI.
- **Unified Domain Models**: The `@libs/domain` package serves as the single source of truth for both raw serialization and runtime schemas.
- **Enhanced AI Tool Call Support**: The standard `Command` metadata (name, title, description, inputSchema, outputSchema) provides all the necessary descriptors to automatically expose commands as AI tool definitions.
- **Path Security**: All commands will resolve absolute paths via a safe path helper (`getAbsPath`) using the `projectDir` parameter, protecting against directory traversal.
