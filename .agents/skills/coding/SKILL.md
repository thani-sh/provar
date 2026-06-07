---
name: coding
description: Coding guidelines, naming standards, Go-style comments, TypeScript best practices, and verification steps.
---

# Coding Standards Guide

This skill provides the core coding standards, TypeScript best practices, and code style guidelines to adhere to when developing features or refactoring code in the Provar workspace.

## Naming Conventions

To keep the codebase uniform, clean, and highly readable, use these conventions:

- **Variables & Functions:** `camelCase` (e.g., `isTestRunning`, `executeStep`).
- **Classes & Types:** `PascalCase` (e.g., `ExecutionEngine`, `TestState`).
- **Global Constants:** `UPPER_CASE` (e.g., `MAX_RETRY_COUNT`, `DEFAULT_PORT`).
- **Files & Directories:** `kebab-case` (e.g., `readme-lib-template.md`, `test-runner.ts`).

---

## Go-style Comments

You **MUST** always add comments above functions, types, classes, and other exported values. Instead of verbose block JSDoc comments with annotations like `@param` or `@returns`, use concise **Go-style comments**. The comment must be a complete sentence starting with the name of the documented item. **Examples:**

```typescript
/**
 * executeEngine initiates the runner with the given configuration.
 */
function executeEngine(config: EngineConfig): void {
  // ...
}

/**
 * EngineState represents the current execution context.
 */
interface EngineState {
  status: "idle" | "running" | "completed";
}
```

---

## TypeScript Best Practices

- **Strict Typing:** Avoid using `any`. Use `unknown` if the type is dynamic, or define custom interfaces and union types.
- **Explicit Types:** Prefer explicit type annotations for function signatures, class members, and public exports to ensure API boundary safety.
- **Generators & Iterators:** We encourage the use of generator functions, particularly **async generators** and **async iterators** (e.g. for streaming LLM client responses or handling step-by-step test execution flows).
- **Monorepo Import Path Aliases:**
  - **ALWAYS** use workspace aliases defined in `tsconfig.json` paths for importing from other monorepo packages.
  - **NEVER** use relative path imports (e.g. `../../libs/domain/src/zod`) across package boundaries.
  - Common package alias paths:
    - `@libs/domain`
    - `@libs/engine`
    - `@libs/config`
    - `@libs/models`

---

## Pre-Completion Verification

Before concluding any implementation task:
1.  **Build Verification:** Run `bun run build` to verify that your changes compile successfully and introduce no TypeScript type errors.
2.  **Lint Verification:** Run `bun run lint` to check for style violations. If violations exist, run `bun run lint:fix` to auto-fix formatting issues.
