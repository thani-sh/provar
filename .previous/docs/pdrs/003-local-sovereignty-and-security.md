# 003 - Local Sovereignty and Security

## Context

Enterprise users are often concerned about data privacy and security when using cloud-based testing or AI platforms.

## Decision

All test data, visual graphs, and generated code will remain **locally in the team's project** (Git-native). AI is used for creation/maintenance, but execution is local/CI-based.

## Consequences

- High level of security and data privacy.
- No dependency on a central cloud for basic test execution.
- Easy integration with existing local development workflows.
