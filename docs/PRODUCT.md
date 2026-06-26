# Provar — Product Specification (Living)

This document is the **single source of truth for what Provar is and who it's for**. It is a living specification representing the current state of the product.

For the elevator pitch see [README.md](../README.md). For technical details and system design see [docs/SYSTEMS.md](SYSTEMS.md). For the contributor rules see [AGENTS.md](../AGENTS.md).

---

## 1. What Provar is

Provar is a **Git-native, AI-assisted end-to-end testing tool** for web applications. Tests are designed as directed graphs of steps on a visual canvas, while the underlying browser automation is written by an AI agent observing the live page state. Tests, baselines, and configuration live in the project repository and run entirely locally or in CI without cloud dependency.

The product consists of three surface units:

- **Graphical Editor** (`apps/provar-app`): Desktop application to author and debug tests visually (Primary surface for web developers).
- **Command-Line Interface** (`apps/provar-cli`): The `provar` CLI to run tests headlessly in CI and scripting environments (CI pipelines, power users).
- **Product Website** (`apps/provar-web`): Marketing, documentation, and the end-user guide (New users, evaluators).

## 2. Who it is for

Provar is built for **working web developers** who want to author end-to-end tests without hand-writing brittle selectors or relying on a cloud service.

- **Target Audience**: Developers comfortable with Git, terminals, and code editors.
- **Not For**: Non-developers, mobile/desktop applications, and teams requiring a hosted, collaborative multi-user platform (collaboration in Provar happens via Git).

## 3. Core concepts

- **project**: A directory containing the application under test and the `.provar/` testing configuration.
- **step**: A single user-facing action in a test (click, type, assert, navigate).
- **path**: A sequence of steps representing one execution route through the test graph.
- **canvas**: The visual workspace where the test graph is drawn.
- **baseline**: The approved screenshot reference of a step used for visual diffing.
- **run**: The execution of a single path.
- **test run**: A full run of all test paths in the project.

## 4. North-Star Metric

**Time from cloning/install to first passing test run.** (Target: under 30 minutes).
