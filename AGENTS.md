# Agent Instructions

Project status: Provar is a developer tool built by a single developer over weekends. It is in early development stage without any active users.

- Prefer breaking changes to API to avoid complexity.
- Use `@provar/` npmjs scope for public npm packages.
- Use `provar.se` domain name for websites and emails.

In addition, the `@thani-sh/` npmjs scope is owned by the developer and libraries published under this scope can be modified if it is necessary to support this project.

## Tooling

- **MUST use Bun** (`bun install`, `bun run`, etc.) for package management.
- **NEVER** use `npm`, `npx`, `yarn`, or `pnpm`.

## Getting started

- **ALWAYS** install dependencies after creating a new branch using `bun install`.
- **NEVER** run `bun run dev`, ask the user, most likely it is already running.

## Version Control

- **ALWAYS** ask whether to use a worktree or not unless explicitly told somehow.
- **ALWAYS** perform the following cleanup steps after the user verifies the task is done:
  - Rebase and merge the branch to `main`.
  - Remove the git worktree and any other temporary files.
- **NEVER** commit without explicit user approval after they have tested and verified.
- **NEVER** create merge commits, rebase instead. Keep the history linear.
- **STRICTLY** follow **Conventional Commits** for commit messages.
  - **ALWAYS** add a `type` and a short `description` to the commit message.
  - **NEVER** use scopes in commit messages.
  - **NEVER** use uppercase letters in commit messages.
  - **NEVER** add extra lines to the commit messages.
- **STRICTLY** follow branch naming strategy described below.
  - **ALWAYS** use hyphens `-`, do not use underscores `_` or camel case `camelCase`.
  - **NEVER** add any prefix to the branch name (e.g., `feat/` or `fix/`).
  - **NEVER** use uppercase letters in branch names.

## Monorepo Structure

- `apps/`: Applications
- `libs/`: Reusable code
- `docs/`:
  - `PRODUCT.md`: Living product specification (single source of truth for what Provar is,
    who it is for, the surface area, and the north-star metric). Read this before changing
    product-facing behavior.
  - `adrs`: Architecture decision records (ADRs) — one file per non-obvious technical choice.
  - `pdrs`: Product decision records (PDRs) — one file per non-obvious product choice.
  - `DESIGN.md`: Design system and UI guidelines.
  - `TODOS.md`: Active work log and known issues. The only "in motion" doc.

When adding a new `.md` file, consult the doc map in `docs/PRODUCT.md` § 8 first.
