# @libs/compiler

A shared compiler library designed to translate visual Provar graph definitions (`.test.yml`) into native, high-performance Playwright test execution scripts (`.test.ts`).

## Installation

Add it as a dependency in your package.json:

```json
{
  "dependencies": {
    "@libs/compiler": "workspace:*"
  }
}
```

## Features

- **Path Resolution**: Traverses visual graphs with complex branching logic, resolving them into distinct test suites to ensure complete path coverage.
- **AI-Powered Grounding**: Leverages `@libs/executor` to execute partial test paths, scrape real-time page content (DOM, accessibility trees), and feed these contexts directly to target AI clients.
- **Self-Correction Loop**: Catches test execution errors and feeds back full error contexts to enable iterative refinement.

## Usage

### 1. Compile a Graph Definition

You can compile a `.test.yml` file into a declarative `.test.ts` test specification:

```typescript
import { compile } from "@libs/compiler";

const result = await compile({
  yamlPath: "./tests/checkout.test.yml"
});

console.log(`Successfully compiled! Output saved to: ${result.outputPath}`);
```

### 2. Resolving Paths

If you want to inspect all possible pathways inside a test graph definition without writing files:

```typescript
import { resolvePaths, TestGraph } from "@libs/compiler";

const graph: TestGraph = {
  name: "Branching Flow",
  graph: {
    info: "Tests two payment options",
    start: "node-login",
    nodes: {
      "node-login": { title: "Login", info: "Fill email and pass", next: ["node-card", "node-paypal"] },
      "node-card": { title: "Pay by Card", info: "Submit card details" },
      "node-paypal": { title: "Pay by PayPal", info: "Submit paypal details" }
    }
  }
};

const paths = resolvePaths(graph);
console.log(paths);
// Output: [["node-login", "node-card"], ["node-login", "node-paypal"]]
```

### 3. Interactive AI Grounding

The compiler uses a feedback loop to dynamically correct AI code generation:

```typescript
import { groundAndGenerateAction } from "@libs/compiler";

const generatedCode = await groundAndGenerateAction(
  "./tests/temp.test.ts",
  "action-checkout-btn",
  { title: "Click Checkout Button", info: "Find the primary green checkout button and click it" },
  {
    generateCode: async (prompt, context) => {
      // Connects to Gemini or your custom model
      return "await api.page.click('button.green-primary-checkout');";
    }
  }
);
```
