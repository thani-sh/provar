---
name: writing
description: Guidelines for maintaining clean, high-quality, and non-bloated documentation.
---

# Writing & Documentation Guide

Provar documents must remain concise, accurate, and free of bloat.

## General Guidelines

- **No Technology Stack Bloat**: Do not include generic lists of technologies used (e.g., "built with Svelte/Vite/Bun"). Keep descriptions focused entirely on the project's purpose, features, and target user value.
- **Single Source of Truth**: User-facing specifications go into `docs/PRODUCT.md`. Technical design/architecture details go into `docs/SYSTEMS.md`. Do not duplicate information between them.
- **Conciseness**: Keep paragraphs short. Do not use soft line wraps (line breaks within paragraphs) — let paragraph text exist on a single line so it wraps naturally in viewers.

## README Templates

- **Applications**: Every application in the `apps/` directory should have a concise `README.md` at its root outlining setup and development instructions.
- **Shared Libraries**: Every package in the `libs/` directory should have a brief `README.md` explaining the package API and standard usage.
