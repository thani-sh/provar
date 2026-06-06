# @libs/domain

A shared library providing the core domain models, schema definitions, and TypeScript interfaces for the Provar monorepo. It serves as the single source of truth for both raw serialized disk representations and in-memory runtime objects.

## Key Features

- **Schema Validation:** Comprehensive Zod schemas (found in `@libs/domain/zod`) for configurations and visual test graphs.
- **Unified TypeScript Types:** Core TypeScript interfaces representing graphs, projects, tasks, and paths.
- **Generic Execution Bindings:** Exposes generic `ExecutableFile<T>` and `ExecutableTask<T>` types, allowing dynamic JS/TS execution bindings to be decoupled from specific runner platforms.
- **Strict Isolation:** Leaf-level package with zero dependencies on other internal `@libs/*` projects and no application side-effects.

## Usage

```typescript
import { schemaForFile } from "@libs/domain/zod";
import type { Task, File, ExecutableFile } from "@libs/domain";

// Example parsing and validation
const fileData = schemaForFile.parse({
  name: "login-flow",
  graph: {
    info: "Verify user login works",
    start: "task_abc12",
    nodes: {
      "task_abc12": {
        title: "Go to login page",
        info: "Navigates to /login",
        next: "task_def34"
      },
      "task_def34": {
        title: "Fill in credentials",
        info: "Enters username and password"
      }
    }
  }
});
```
