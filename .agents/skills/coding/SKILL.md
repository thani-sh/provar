---
name: coding
description: Coding guidelines, Go conventions, styling, and code quality expectations.
---

# Go Coding Standards Guide

Provar is written in Go with a focus on simplicity, readability, and avoiding bloat. Adhere strictly to these coding standards.

## Code Quality & Anti-Bloat

- **Minimal Dependencies**: Do not add external packages unless absolutely necessary. Rely on the Go standard library first.
- **Idiomatic Go**: Use idiomatic Go structures. Handle errors explicitly. Never use `panic` or recover unless a panic is truly unrecoverable.
- **Zero Redundancy**: Avoid unnecessary allocations, deep nested blocks, and redundant logic. Keep functions short and single-purpose.
- **Strict Types**: Avoid using `any` or `interface{}` unless designing generic wrappers or interface boundaries where dynamic type inspection is required.
- **Respect Library Responsibilities**: Adhere strictly to the defined purpose and boundary of each library/sub-package in the workspace (refer to `docs/SYSTEMS.md` for definitions). Never blur architectural concerns or introduce circular dependencies between these components.

## Naming & Style

- **Conventions**: Use standard Go naming (camelCase for variables/functions, PascalCase for types/structs/exported items).
- **Return Early**: Encourage a "return early" approach to reduce code nesting depth.
- **Function Body Layout**: Strictly avoid empty lines inside any function body.
- **Function Comments**: Add comments inside function bodies only when absolutely necessary (e.g., `TODO` and `FIXME` comments are allowed exceptions).
- **Constants & Magic Values**: Strictly avoid magic strings or numbers inside function bodies. Declare them at the top of the file as constants (or package-level variables if non-constant).
- **Error Handling vs Defaults**: Avoid using default fallback values whenever possible (e.g., default model names) or falling back to environment variables for API keys/credentials. Instead, return an error (fail explicitly) if a required parameter is missing or invalid.
- **Exported Symbols & Public API**: Every exported function, type, and struct must have a doc comment that begins with the name of the symbol (e.g., `// Execute runs the test compiler...`).
- **Minimize Exports**: Pay great attention to public symbols (exported structs, fields, methods, functions, etc.). To prevent public API bloat, keep as much as possible package-private. **ALWAYS** ask the user for approval before adding or modifying any public exports.

## Pre-Completion Verification

Before completing any task:
1. **Formatting**: Run `go fmt ./...`.
2. **Linting & Safety**: Run `go vet ./...` (and `golangci-lint run` if available).
3. **Build**: Verify that the application compiles without warnings.
