# @libs/executor

A shared library providing the core Playwright-backed browser automation framework, custom assertion mechanisms, state encapsulation, and event-driven test execution.

## Key Features

- **Playwright Backed:** Reliable, high-performance browser automation built on Playwright.
- **Event-Driven Execution:** Streams real-time test execution events using an asynchronous generator.
- **State Encapsulation:** Safe state isolation and variable scoping across tasks.
- **Partial Execution:** Supports pausing or stopping at specific steps for live AI grounding.

## Usage

### 1. Declaring Tests (`.test.ts`)

Test files are compiled to a set of task functions and paths:

```typescript
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["task_1"]: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
  },
  ["task_2"]: async (api: TestAPI) => {
    const heading = api.page.locator("h1");
    await api.expect(heading).toBeVisible();
  },
};

export const paths = [
  ["task_1", "task_2"],
];
```

### 2. Running Tests Programmatically

Import the library to execute resolved paths and monitor step-by-step progress using the asynchronous generator:

```typescript
import { execute } from "@libs/executor";

const runner = await execute(selectedPath, {
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

For AI grounding or self-correction, run tests up to a specific task:

```typescript
const runner = await execute(selectedPath, {
  upToTaskId: "task_1", // Stop after task_1 finishes
  headless: true
});
```
