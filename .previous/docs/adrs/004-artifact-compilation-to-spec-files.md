# 004 - Artifact Compilation to Spec Files

## Context

Running tests by parsing YAML graphs at runtime can be complex and may introduce performance overhead or debugging difficulties in the execution environment.

## Decision

We will **compile** successfully generated logic and graph metadata into clean, standalone `<name>.test.ts` files on the same directory as the `<name>.test.yml` file. The original YAML files are only required for editing and are not used during execution.

## Consequences

- Faster execution since tests are native Playwright specs.
- Easier debugging using standard Playwright tools.
- Clear separation between the visual design layer and the executable code layer.
