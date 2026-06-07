---
name: testing
description: Guidelines for compiling, running, and writing unit and E2E tests in the Provar workspace.
---

# Testing & Verification Guide

This skill provides guidelines and commands for running existing tests, writing new tests, and compiling/executing Provar E2E tests.

---

## Provar E2E Test Structure

Provar utilizes a graph-based testing approach. E2E tests are stored under the `.provar/tests/` directory of an application (e.g., `apps/demo-social/.provar/tests/`).

Each test consists of two parts:
1.  **Graph Schema (`.test.yml`):** Defines test metadata, execution nodes, and branching flows.
2.  **Implementation (`.test.ts`):** Contains the actual task execution functions written in Playwright.

### Writing E2E Tasks
Tasks in the `.test.ts` file receive a `TestAPI` parameter:

```typescript
import type { TestAPI } from "@libs/engine";

export const tasks = {
  ["task_login_step"]: async (api: TestAPI) => {
    await api.page.goto(api.var.baseUrl);
    await api.page.locator('input[placeholder="Username"]').fill(api.var.user.username);
    await api.page.locator('input[placeholder="Password"]').fill(api.var.user.password);
    await api.page.locator('button:has-text("Sign In")').click();
    await api.expect(api.page.locator('#post-composer-textarea')).toBeVisible();
  },
};
```

Use Playwright locators and assertions via `api.page` and `api.expect` inside task functions.

---

## Provar CLI Commands

To compile or execute Provar tests, run the following CLI commands from the project root:

### 1. Compiling Tests
Compiles `.test.yml` files, generates path configurations, and updates `.test.ts` execution files:
```bash
bun run provar compile <test-file-path|dir> [--trace]
```
*Example:* `bun run provar compile apps/demo-social/.provar/tests/auth/login.test.yml --trace`

### 2. Running E2E Test Suites
Executes the compiled `.test.ts` files:
```bash
bun run provar run <test-file-path|dir> [options]
```
*Options:*
*   `--up-to <taskId>`: Run the E2E test execution only up to the specified task ID.
*   `--headless <true|false>`: Set to false to run the browser in headed mode (default: true).

*Example:* `bun run provar run apps/demo-social/.provar/tests/auth/login.test.ts`

---

## Unit & Integration Tests

For library functions (e.g., in `libs/engine`, `libs/domain`, `libs/config`), use Bun's native test runner:

- To run all tests in the workspace:
  ```bash
  bun test
  ```
- To run tests in a specific folder or file:
  ```bash
  bun test <path/to/test/file>
  ```
