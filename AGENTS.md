# Agent Instructions

Project status: Provar is a developer tool built in Go and Typescript, designed with a focus on simplicity, minimal dependencies, and strict resistance to code bloat.

## Current Project Focus

This project is currently being migrated from Bun to Go. We will migrate features step by step while maintaining a high level of code and API quality. The previous version is in the `.previous` directory.

## Tooling & Verification

- **Go Code**: ALWAYS Use standard Go commands. Always run `go fmt ./...` and `go vet ./...` to verify code.
- **TS Code**: ALWAYS use Bun (`bun install`, `bun run`) for dependency management inside `apps/provar-web`

## Version Control

- **Cleanup**: After verification, rebase and merge to `main`, and clean up any worktrees/temporary files.
- **Branches**: Lowercase with hyphens only, no prefixes, no uppercase letters, e.g., `feature-name`.
- **Commits**: Never commit without explicit user approval. Never make merge commits (keep history linear).
  - Follow Conventional Commits: lowercase only, no scopes, no extra lines, e.g., `type: short description`.

## Monorepo Structure

- `apps/`: User applications
- `libs/`: Reusable packages
- `docs/`: Product documentation

When adding markdown documentation, consult the structure above first.
