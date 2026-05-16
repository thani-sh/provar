# 006 - Git-Native Storage Conventions

## Context

Project assets (graphs, code, config) need to be stored in a way that is human-readable, easily versioned, and integrates well with existing developer workflows.

## Decision

We will use a **Git-native storage** approach:

- **YAML** for readable graph definitions and configuration.
- **TypeScript** for generated AI code.
- Organized folder structure (e.g., `.provar/nodes`, `.provar/suites`).
- Test suites on `.provar/suites` can use multiple levels of sub folders.

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
- **`.provar/nodes/`**: Contains reusable graph components. Each node is a `<name>.node.yml` definition compiled to `<name>.node.ts`.
- **`.provar/suites/`**: Contains end-to-end test suites. Each suite is a `<name>.spec.yml` definition compiled to `<name>.spec.ts`. Sub folders under `suites` can be used to organize the test suites.

### Examples

#### 1. Configuration (.provar/config.yml)

Stores project-level settings and maps environment variables to secure secrets.

```yaml
provider:
  type: openai
  model: gpt-4o
variables:
  TEST_USER_EMAIL: ${ENV.PROVAR_TEST_EMAIL}
  TEST_USER_PASSWORD: ${ENV.PROVAR_TEST_PASSWORD}
```

#### 2. Reusable Nodes

Nodes use a graph structure to allow internal branching and flow control.

**.provar/nodes/login_flow.node.yml**

```yaml
name: "Login Flow"
inputs:
  - email
  - password
outputs:
  - sessionToken
graph:
  start: "action_1"
  nodes:
    action_1:
      title: "Navigate to /login"
      next: "action_2"
    action_2:
      title: "Fill in email and password, then click submit"
```

**.provar/nodes/login_flow.node.ts (Generated AI Code)**

```typescript
// date: 2026-05-14T10:11:00Z
// hash: 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
import { action, Page, TestAPI } from "@provar/execute";

export const metadata = {
  name: "Login Flow",
  inputs: ["email", "password"],
  outputs: ["sessionToken"],
};

const action_navigate_to_login = action(
  "1",
  "Navigate to /login",
  async (api: TestAPI) => {
    await api.page.goto("/login");
  },
);

const action_submit_credentials = action(
  "2",
  "Fill in email and password, then click submit",
  async (api: TestAPI) => {
    await api.page.fill('input[name="email"]', api.inputs.email);
    await api.page.fill('input[name="password"]', api.inputs.password);
    await api.page.click('button[type="submit"]');
  },
);

export const execute = async (api: TestAPI) => {
  await action_navigate_to_login(api);
  await action_submit_credentials(api);
  const sessionToken = await api.page.evaluate(() =>
    localStorage.getItem("session_token"),
  );
  return { sessionToken };
};
```

#### 3. Test Suites

Test suites can define complex paths using next arrays to create branches, and nested graph definitions to group sub-steps.

**.provar/suites/checkout_flow.spec.yml**

```yaml
name: "Checkout Process"
graph:
  info: "Verifies the end-to-end checkout process, including payment sub-steps."
  start: "action_v2b3n"
  nodes:
    action_v2b3n:
      title: "Login to account"
      node: "login_flow"
      with:
        email: ${secrets.TEST_USER_EMAIL}
        password: ${secrets.TEST_USER_PASSWORD}
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

**.provar/suites/checkout_flow.spec.ts (Generated AI Code)**

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

const action_login_to_account = action(
  "v2b3n",
  "Login to account",
  async (api: TestAPI) => {
    const inputs = {
      email: process.env.PROVAR_TEST_EMAIL,
      password: process.env.PROVAR_TEST_PASSWORD,
    };
    const outputs = await execute("login_flow", api, inputs);
    api.context.loginToken = outputs.sessionToken;
  },
);

const action_add_item_to_cart = action(
  "k1l2m",
  "Add item to cart",
  async (api: TestAPI) => {
    await api.page.goto("/product/test-item");
    await api.page.click('button:has-text("Add to Cart")');
  },
);

const action_add_discount_code = action(
  "d1c2d",
  "Add discount code",
  async (api: TestAPI) => {
    await api.page.click(".cart-icon");
    await api.page.fill('input[name="promo_code"]', "TESTDISCOUNT");
    await api.page.click('button:has-text("Apply")');
  },
);

const action_enter_credit_card = action(
  "w3x4y",
  "Enter credit card",
  async (api: TestAPI) => {
    await api.page.fill('input[name="cardNumber"]', "4242424242424242");
  },
);

const action_submit_payment = action(
  "a7b8c",
  "Submit payment",
  async (api: TestAPI) => {
    await api.page.click('button:has-text("Pay Now")');
  },
);

const action_process_payment = action(
  "o5p6q",
  "Process payment",
  async (api: TestAPI) => {
    await api.page.click('button:has-text("Checkout")');
    await action_enter_credit_card(api);
    await action_submit_payment(api);
    await expect(api.page.locator(".order-complete-message")).toBeVisible();
  },
);

suite(metadata.name, () => {
  // Path 1
  test("Successful checkout with discount applied", [
    action_login_to_account,
    action_add_item_to_cart,
    action_add_discount_code,
    action_process_payment,
  ]);

  // Path 2
  test("Successful checkout without discount", [
    action_login_to_account,
    action_add_item_to_cart,
    action_process_payment,
  ]);
});
```
});
```
