# Agent Instructions

## Tooling
- **MUST use Bun** (`bun install`, `bun run`, etc.) for all package management and execution.
- **NEVER** use `npm`, `npx`, `yarn`, or `pnpm`.

## Monorepo Structure
- `apps/`
  - `editor`: Frontend workspace and editor interface.
- `libs/`
  - `agents`: Core AI agent frameworks and helpers.
- `demo/`
  - `checkout`, `todolist`: Mock applications used to verify and test E2E tests.
- `docs/`: Architecture decision records (ADRs) and design documentation.
