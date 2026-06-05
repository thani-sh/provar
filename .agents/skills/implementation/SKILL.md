---
name: implementation
description: Describes how to implement new features and refactors.
---

# Implementation Guide

This guide describes the core implementation standards, repository rules, and coding styles to adhere to when developing features or refactoring code in the Provar workspace.

## Core Rules (from AGENTS.md)

### 1. Tooling & Setup

- **Package Management:** You **MUST** use Bun (`bun install`, `bun run`, etc.). **NEVER** use `npm`, `npx`, `yarn`, or `pnpm`.
- **First Steps:** **ALWAYS** install dependencies after creating a new branch using `bun install`.
- **Development Server:** **NEVER** run `bun run dev` unless explicitly asked; the user likely has it running already.

### 2. Version Control & Git Workflow

- **Branches:**
  - **ALWAYS** use the `main` branch for development.

- **Conventional Commits:**
  - **ALWAYS** add a `type` and a short `description` to the commit message.
  - **NEVER** use scopes in commit messages.
  - **NEVER** use uppercase letters in commit messages.
  - **NEVER** add extra lines to the commit messages.

## Coding Style & Standards

To keep the codebase uniform, clean, and highly readable, follow these TypeScript/JavaScript standards:

### Naming Conventions

- **Variables & Functions:** `camelCase` (e.g., `isTestRunning`, `executeStep`).
- **Classes & Types:** `PascalCase` (e.g., `ExecutionEngine`, `TestState`).
- **Global Constants:** `UPPER_CASE` (e.g., `MAX_RETRY_COUNT`, `DEFAULT_PORT`).
- **Files & Directories:** `kebab-case` (e.g., `shared-library-readme-template.md`, `test-runner.ts`).

### Go-style Comments

Instead of verbose block JSDoc comments with annotations like `@param` or `@returns`, use concise **Go-style comments**. The comment must be a complete sentence starting with the name of the documented item. **Examples:**

```ts
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

### TypeScript Practices

- **Strict Typing:** Avoid `any`. Use `unknown` if the type is dynamic, or define custom interfaces/unions.
- **Explicit Types:** Prefer explicit type annotations for function signatures, class members, and public exports.
