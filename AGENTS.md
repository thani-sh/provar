# Agent Instructions

## Tooling
- **MUST use Bun** (`bun install`, `bun run`, etc.) for package management.
- **NEVER** use `npm`, `npx`, `yarn`, or `pnpm`.

## Monorepo Structure
- `apps/`
  - `editor`: Frontend workspace and editor interface.
- `libs/`
  - `agents`: Core AI agent frameworks and helpers.
- `demo/`
  - `todolist`: Mock application used to verify and test E2E tests.
- `docs/`:
  - `adrs`: Architecture decision records (ADRs)
  - `pdrs`: Product decision records (PDRs)
  - `DESIGN.md`: Design system and UI guidelines.
