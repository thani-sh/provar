# 007 - Product Roadmap

## Context

A clear roadmap is needed to communicate the long-term strategy and evolution of Provar to users and contributors.

## Decision

We will follow a phased roadmap to expand Provar from a local developer tool to a collaborative cloud platform:

### Phase 1: Developer Tool (Current)

Focus on individual developer empowerment.

- Local creation, execution, and maintenance of test graphs.
- Integration into local dev environments and CI/CD workflows.

### Phase 2: Self-Hostable Server

Introduction of a self-hostable component for centralized monitoring.

- Centralized test execution history and recording.
- Collaborative review across teams.
- Note: Execution still happens in local/CI environments.

### Phase 3: Provar Cloud

Fully managed cloud platform.

- Simplified orchestration and scaling.
- Managed infrastructure with zero overhead.
- Alternative to the self-hosted component.

## Consequences

- Allows the team to focus on building a robust core (Phase 1) before scaling
- Provides a clear path for enterprise adoption (Self-hostable).
- Offers a low-friction entry point for teams via Provar Cloud.
