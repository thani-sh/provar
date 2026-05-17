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
  start: "action_v2b3n"
  nodes:
    action_v2b3n:
      title: "Login to account"
      info: "Navigate to /login and enter the test email and password."
      next: "action_k1l2m"
    action_k1l2m:
      title: "Add item to cart"
      info: "Navigate to a product page and click the 'Add to Cart' button."
      next:
        - "action_d1c2d"
        - "action_o5p6q"
    action_d1c2d:
      title: "Add discount code"
      info: "Enter a valid discount code in the promo box and apply it."
      next: "action_o5p6q"
    action_o5p6q:
      title: "Process payment"
      info: "Complete the payment form. This action uses a sub-graph to describe the payment steps."
      asserts:
        assert_s9t0u:
          title: "Verify order confirmation"
          info: "Ensure the 'Order Complete' message is shown to the user."
      graph:
        info: "Steps to fill out the payment details."
        start: "action_w3x4y"
        nodes:
          action_w3x4y:
            title: "Enter credit card"
            info: "Type the test credit card number into the card field."
            next: "action_a7b8c"
          action_a7b8c:
            title: "Submit payment"
            info: "Click the 'Pay Now' button."
```

**.provar/tests/checkout_flow.test.ts (Generated AI Code)**

When the generator encounters branches, it resolves all possible paths from the start node to the end nodes and produces isolated Playwright tests built from the individual action functions. The YAML file is not parsed during execution.

```typescript
// date: 2026-05-14T12:20:00Z
// hash: 2a947d6a520e5c9b83b3f2e1a3962d3a77a942a033db863c4e098801d0a5e2f7
import {
  suite,
  test,
  action,
  expect,
  execute,
  Page,
  TestAPI,
} from "@provar/execute";

export const metadata = {
  name: "Checkout Process",
  info: "Verifies the end-to-end checkout process, including payment sub-steps.",
};

const action_login_to_account = action({
  id: "v2b3n",
  title: "Login to account",
  execute: async (api: TestAPI) => {
    await api.page.goto(`${api.var.baseUrl}/login`);
    await api.page.fill('input[name="email"]', api.var.user.email);
    await api.page.fill('input[name="password"]', api.var.user.password);
    await api.page.click('button[type="submit"]');
  },
});

const action_add_item_to_cart = action({
  id: "k1l2m",
  title: "Add item to cart",
  execute: async (api: TestAPI) => {
    await api.page.goto(`${api.var.baseUrl}/product/test-item`);
    await api.page.click('button:has-text("Add to Cart")');
  },
});

const action_add_discount_code = action({
  id: "d1c2d",
  title: "Add discount code",
  execute: async (api: TestAPI) => {
    await api.page.click(".cart-icon");
    await api.page.fill('input[name="promo_code"]', "TESTDISCOUNT");
    await api.page.click('button:has-text("Apply")');
  },
});

const action_enter_credit_card = action({
  id: "w3x4y",
  title: "Enter credit card",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[name="cardNumber"]', "4242424242424242");
  },
});

const action_submit_payment = action({
  id: "a7b8c",
  title: "Submit payment",
  execute: async (api: TestAPI) => {
    await api.page.click('button:has-text("Pay Now")');
  },
});

const action_process_payment = action({
  id: "o5p6q",
  title: "Process payment",
  execute: async (api: TestAPI) => {
    await api.page.click('button:has-text("Checkout")');
    await action_enter_credit_card(api);
    await action_submit_payment(api);
    await expect(api.page.locator(".order-complete-message")).toBeVisible();
  },
});

export const tests = [
  // Path 1
  test("Successful checkout with discount applied", [
    action_login_to_account,
    action_add_item_to_cart,
    action_add_discount_code,
    action_process_payment,
  ]),
  // Path 2
  test("Successful checkout without discount", [
    action_login_to_account,
    action_add_item_to_cart,
    action_process_payment,
  ]),
];
```
