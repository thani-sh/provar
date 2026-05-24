---
name: documentation
description: Describes how to write ADRs, PDRs, READMEs, etc.
---

# Documentation Guide

This skill provides guidelines and templates for maintaining consistent and high-quality documentation across the Provar codebase. Use the templates below to structure new documentation.

## General Guidelines

- **Never include "Built with X, Y, Z" details:** Technology stack lists (e.g., "Built with Svelte, Electrobun, Vite") are useless information for users. Keep descriptions focused entirely on the project's purpose, key features, and primary goals.


## Guidelines & Templates

### 1. Shared Library READMEs

Every package in the `libs/` directory should have a concise `README.md` at its root explaining what the library does, its key features, installation instructions, and basic TypeScript usage.

- Template file: [shared-library-readme-template.md](./resources/shared-library-readme-template.md)

### 2. Application READMEs

Every application in the `apps/` or `demo/` directory should have a `README.md` introducing the app, explaining its primary features, and providing clear setup instructions.

- Template file: [application-readme-template.md](./resources/application-readme-template.md)

### 3. Architecture Decision Records (ADRs)

We use ADRs to record significant architectural choices made during the development of Provar. ADRs are stored under `docs/adrs/` as Markdown files.

- Template file: [adr-template.md](./resources/adr-template.md)
- Standard Naming: `XXX-short-title.md` (e.g., `011-dynamic-test-path-identity.md`)
- Status Mapping:
  - Open Pull Request: **In Review**
  - Merged to main/develop: **Accepted**

### 4. Product Decision Records (PDRs)

We use PDRs to document significant product choices, target audience focus, and product roadmap milestones. PDRs are stored under `docs/pdrs/` as Markdown files.

- Template file: [pdr-template.md](./resources/pdr-template.md)
- Standard Naming: `XXX-short-title.md`
- Status Mapping:
  - Open Pull Request: **In Review**
  - Merged to main/develop: **Accepted**
