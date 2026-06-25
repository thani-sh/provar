# 006 - Git-Native Storage Conventions

## Context

Project assets (graphs, code, config) need to be stored in a way that is human-readable, easily versioned, and integrates well with existing developer workflows.

## Decision

We will use a **Git-native storage** approach:

- **YAML** for readable graph definitions and configuration.
- **TypeScript** for generated AI code.
- Organized folder structure (e.g., `.provar/tests`).
- Tests on `.provar/tests` can use multiple levels of sub folders.

## Consequences

- Full version history through standard Git tools.
- Easy code reviews of both visual intent (YAML) and generated logic (TS).
- Seamless integration into CI/CD pipelines.

## Details

### Format Standards

1. **YAML**: Used for all "source of truth" definitions that require human readability and visual representation.
2. **TypeScript**: Used for generated code to ensure type safety, modularity, and compatibility with the Playwright ecosystem.
3. **Variables**: Environment variables are mapped in `config.yml` using the `${ENV.VAR_NAME}` syntax and referenced in graphs as `${vars.VAR_NAME}`.

### Directory Structure

The project configuration and test assets are stored in the `.provar/` directory at the root of the repository:

- **`.provar/config.yml`**: Central configuration for AI providers and secret mappings.
- **`.provar/tests/`**: Contains end-to-end test files. Each test is a `<name>.test.yml` definition compiled to `<name>.test.ts`. Sub folders under `tests` can be used to organize the tests.

### Examples

#### 1. Configuration (.provar/config.yml)

Stores project-level settings and maps environment variables to secure secrets.

```yaml
provider:
  name: gemini
  apiKey: ${ENV.GEMINI_API_KEY}
variables:
  baseUrl: https://stg1.app.provar.se
  user:
    email: ${ENV.USER_EMAIL}
    password: ${ENV.USER_PASSWORD}
```

#### 2. Tests

Tests can define complex paths using next arrays to create branches, and nested graph definitions to group sub-steps.

**.provar/tests/checkout_flow.test.yml**

```yaml
name: "Checkout Process"
graph:
  info: "Verifies the end-to-end checkout process, including payment sub-steps."
  start: "task_v2b3n"
  nodes:
    task_v2b3n:
      title: "Login to account"
      info: "Navigate to /login and enter the test email and password."
      next: "task_k1l2m"
    task_k1l2m:
      title: "Add item to cart"
      info: "Navigate to a product page and click the 'Add to Cart' button."
      next:
        - "task_d1c2d"
        - "task_o5p6q"
    task_d1c2d:
      title: "Add discount code"
      info: "Enter a valid discount code in the promo box and apply it."
      next: "task_o5p6q"
    task_o5p6q:
      title: "Process payment"
      info: "Complete the payment form. This task uses a sub-graph to describe the payment steps."
      graph:
        info: "Steps to fill out the payment details."
        start: "task_w3x4y"
        nodes:
          task_w3x4y:
            title: "Enter credit card"
            info: "Type the test credit card number into the card field."
            next: "task_a7b8c"
          task_a7b8c:
            title: "Submit payment"
            info: "Click the 'Pay Now' button."
```

**.provar/tests/checkout_flow.test.ts (Generated AI Code)**

When the generator encounters branches, it resolves all possible paths from the start node to the end nodes and produces isolated Playwright tests built from the individual task functions. The YAML file is not parsed during execution.

```typescript
// date: 2026-05-14T12:20:00Z
// hash: 2a947d6a520e5c9b83b3f2e1a3962d3a77a942a033db863c4e098801d0a5e2f7
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["task_v2b3n"]: async (api: TestAPI) => {
    await api.page.goto(`${api.var.baseUrl}/login`);
    await api.page.fill('input[name="email"]', api.var.user.email);
    await api.page.fill('input[name="password"]', api.var.user.password);
    await api.page.click('button[type="submit"]');
  },
  ["task_k1l2m"]: async (api: TestAPI) => {
    await api.page.goto(`${api.var.baseUrl}/product/test-item`);
    await api.page.click('button:has-text("Add to Cart")');
  },
  ["task_d1c2d"]: async (api: TestAPI) => {
    await api.page.click(".cart-icon");
    await api.page.fill('input[name="promo_code"]', "TESTDISCOUNT");
    await api.page.click('button:has-text("Apply")');
  },
  ["task_w3x4y"]: async (api: TestAPI) => {
    await api.page.fill('input[name="cardNumber"]', "4242424242424242");
  },
  ["task_a7b8c"]: async (api: TestAPI) => {
    await api.page.click('button:has-text("Pay Now")');
  },
  ["task_o5p6q"]: async (api: TestAPI) => {
    await api.page.click('button:has-text("Checkout")');
    await tasks["task_w3x4y"](api);
    await tasks["task_a7b8c"](api);
    await api.expect(api.page.locator(".order-complete-message")).toBeVisible();
  },
};

export const paths = [
  // Path 1
  [
    "task_v2b3n",
    "task_k1l2m",
    "task_d1c2d",
    "task_o5p6q",
  ],
  // Path 2
  [
    "task_v2b3n",
    "task_k1l2m",
    "task_o5p6q",
  ],
];
```
