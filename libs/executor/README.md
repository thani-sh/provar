# @libs/executor

A shared library providing the core Playwright-backed browser automation framework, custom assertion mechanisms, state encapsulation, and event-driven test execution.

## Key Features

- **Playwright Backed:** Reliable, high-performance browser automation built on Playwright.
- **Event-Driven Execution:** Streams real-time test execution events using an asynchronous generator.
- **State Encapsulation:** Safe state isolation and variable scoping across actions.
- **Partial Execution:** Supports pausing or stopping at specific steps for live AI grounding.

## Usage

### 1. Declaring Tests (`.test.ts`)

Test files are purely declarative. They specify individual actions and the overall suite pathways:

```typescript
import { test, action, expect, TestAPI } from "@libs/executor";

export const metadata = {
  name: "User Login",
  info: "Verifies standard auth flow"
};

const openPage = action({
  id: "act-1",
  title: "Navigate to landing",
  execute: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
  }
});

const assertLoaded = action({
  id: "act-2",
  title: "Verify hero header",
  execute: async (api: TestAPI) => {
    const heading = api.page.locator("h1");
    await expect(heading).toBeVisible();
  }
});

export const tests = [
  test([openPage, assertLoaded])
];
```

### 2. Running Tests Programmatically

Import the library to execute `.test.ts` suites and monitor step-by-step progress using the asynchronous generator:

```typescript
import { runTest } from "@libs/executor";

const runner = runTest({
  testFilePath: "./tests/login.test.ts",
  headless: true,
  variables: {
    BASE_URL: "http://localhost:6001"
  }
});

// Stream real-time execution events
for await (const event of runner.events()) {
  console.log(`Event: ${event.type}`, event);
}

// Read running states at any time
const state = runner.getState();
console.log("Final state:", state.status);
```

### 3. Partial Execution

For AI grounding or self-correction, run tests up to a specific action:

```typescript
const runner = runTest({
  testFilePath: "./tests/login.test.ts",
  upToActionId: "act-1", // Stop after act-1 finishes
  headless: true
});
```
