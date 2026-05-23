# 010 - Dynamic Test Path Identity and Names

## Context

In Provar, visual graphs (`002`) are resolved into linear paths (`007`) and compiled into executable TypeScript code (`006`). Historically, these compiled files hardcoded static string names representing the path sequence (e.g., `test("Path 1: open app -> login", [...])`).

As defined in `PDR 010`, baking static display names into compiled code creates a brittle workflow. When a developer renames an action's title in the graph editor, the display name in execution logs becomes out of sync unless a re-compilation is forced. Furthermore, screenshot baseline organization (`009`) becomes fragile if it relies on mutable path titles.

To resolve this, we need a technical architecture that:
1. Strips static path name strings from the generated compiled TypeScript.
2. Supports runtime-resolved dynamic path names based on action metadata.
3. Automatically derives unique, immutable Path IDs from the executing actions to organize assets (like screenshots) securely.

## Decision

We will implement **Dynamic Test Path Identity and Names** in the compiler and executor layers.

### 1. Compiler Output Simplification
We have updated the `@libs/compiler` to output tests without pre-computed names, shifting the path-naming responsibility entirely to the runtime. The generated tests array now uses a single-argument array format:

```typescript
export const tests = [
  test([action_v2b3n, action_k1l2m, action_d1c2d]),
];
```

### 2. Resolving Deterministic Path IDs at Runtime
To organize screenshot assets (`009`), the test executor will construct the Path ID dynamically during execution. The ID is formed by:
1. Iterating through the sequence of executing actions.
2. Extracting each action's `id`.
3. Stripping any generic framework prefixes (specifically, `action_`).
4. Joining the resulting tokens with a hyphen (`-`).

```typescript
// Example resolution within the executor:
const pathNameSlug = t.actions
  .map((act) => act.id.replace(/^action_/, ""))
  .join("-");
```

For instance, a path running actions with IDs `action_v2b3n`, `action_k1l2m`, and `action_d1c2d` resolves to the path ID `v2b3n-k1l2m-d1c2d`, matching the naming convention of `.provar/screenshots/...` directories.

## Consequences

- **Minimalist Compiler Footprint**: The compiler is freed from parsing, formatting, or updating human-readable labels, reducing generated code clutter.
- **Dynamic Presentation**: Test runners and visual reporting panels always show up-to-date node titles automatically because path names are resolved dynamically at the moment of execution.
- **Immutable Asset Paths**: Visual assets (such as accepted, current, and diff screenshots) remain perfectly mapped to their corresponding paths since path directories are named using the immutable, prefix-stripped action IDs.

## References

- Extends **006 - Git-Native Storage Conventions** (Simplifies compiled test script syntax).
- Extends **007 - Automated Path Resolution for Branching** (Decouples paths from visual names by giving them deterministic ID signatures).
- Extends **009 - Screenshot Storage and Accepted Comparison** (Provides the deterministic `path-name-slug` implementation).
- Implements **PDR 010 - Dynamic Test Path Generation and Representation** (Translates the product vision of dynamic paths into technical implementation).
