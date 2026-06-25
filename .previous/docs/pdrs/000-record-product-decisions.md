# 000 - Record Product Decisions

## Context

We need to record product-level decisions made during the evolution of Provar to maintain alignment on vision, target audience, and core value propositions.

## Decision

We will use Product Decision Records (PDRs) to document significant product choices. PDRs will be stored in `docs/pdrs` as Markdown files.

Since we use Git-flow, the status of a PDR is determined by its presence in the repository:

- Merged into the main/develop branch means **Accepted**.
- Open Pull Request means **In Review**.

## Consequences

- Product history and evolution are preserved.
- New team members can quickly understand the "why" behind product features.
- Consistent alignment between design, engineering, and product.
