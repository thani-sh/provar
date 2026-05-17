# 002 - Graph-Based Test Definitions

## Context

Standard test automation scripts are often linear and difficult to visualize or manage at scale, especially when dealing with complex branching logic.

## Decision

We will define tests using a visual **graph structure** stored in `<name>.test.yml` files. This allows for clear visualization of paths and complex branching.

## Consequences

- Improved visibility and maintainability of complex test flows.
- Ability to represent non-linear paths.
- Separation of visual intent from technical implementation.
