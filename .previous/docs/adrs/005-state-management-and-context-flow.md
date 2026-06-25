# 005 - State Management and Context Flow

## Context

Complex test flows require sharing data between steps (e.g., a token from login needed for checkout), but global state can lead to side effects and testing isolation issues.

## Decision

We will use a **context object** that flows through the graph.

- A copy is made at each state transition to maintain history.

## Consequences

- Predictable data flow between test steps.
- Ability to audit state at any point in the graph's execution.
