# @libs/parser

A shared parsing library that crawls monorepo directory trees to locate `.provar` workspaces, parses configuration files, and lazy-loads visual test graph definitions.

## Key Features

- **Workspace Traversing:** Automatically crawls parent directory trees to find a valid `.provar` root.
- **Environment Interpolation:** Dynamically parses and resolves environment variable placeholders (`${ENV.VAR_NAME}`) in YAML configs.
- **Zod Validated Parsing:** Validates incoming configs and test graph schemas using `@libs/domain`.
- **Lazy Loaded Tests:** Minimizes memory footprint by lazy-loading and parsing tests on demand.

## Usage

```typescript
import { loadWorkspace } from "@libs/parser";

const workspace = await loadWorkspace("/path/to/project/subfolder");

console.log("Workspace Root:", workspace.provarPath);
console.log("Config variables:", workspace.config.variables);

// Lazy load first test
if (workspace.tests.length > 0) {
  const testDefinition = workspace.tests[0].getDefinition();
  console.log("Loaded test graph name:", testDefinition.name);
}
```
