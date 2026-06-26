# Provar — Product Specification (Living)

This document is the **single source of truth for what Provar is and who it's for**. It is a living specification representing the current state of the product.

---

## 1. What Provar is

Provar is a **Git-native, AI-assisted end-to-end testing tool** for web applications. Tests are designed as directed graphs of actions, while the underlying browser automation is written by an AI agent observing the live page state. Tests and configuration live in the project repository and run entirely locally or in CI without cloud dependency.

The product consists of three surface units:

- **Graphical Editor** (`apps/provar-app`): Desktop application to author and debug tests visually (Primary surface for web developers).
- **Command-Line App** (`apps/provar-cli`): The `provar` CLI to run tests headlessly in CI and scripting environments (CI pipelines, power users).

## 2. Who it is for

Provar is built for **working web developers** who want to author end-to-end tests without hand-writing brittle selectors or relying on a cloud service.

- **Target Audience**: Developers comfortable with Git, terminals, and code editors.
- **Not For**: Non-developers, mobile/desktop applications, and teams requiring a hosted, collaborative platform.

## 3. Core concepts

- **project**: A directory containing the application under test and the `.provar/` testing configuration.
- **scenario**: A sequence of actions representing one execution route through the test graph.
- **action**: A high-level step of the sequence (e.g., "register as a new user"), representing a node in the test's directed acyclic graph (DAG).

## 4. North-Star Metric

**Time from cloning/install to first passing test run.** (Target: under 30 minutes).
