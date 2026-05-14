# 003 - AI Code Generation Pipeline

## Context

Writing and maintaining Playwright code manually for every node in a graph is time-consuming and error-prone.

## Decision

We will implement an **AI Code Generation Pipeline** that translates visual nodes into Playwright logic. This pipeline uses:

- **Contextual Grounding**: Fetching real-time DOM state and screenshots.
- **Iterative Refinement**: Self-correction by feeding execution errors back to the AI.

## Consequences

- Significant reduction in manual coding effort.
- Automatic adaptation to UI changes through AI-driven self-correction.
- Dependency on external AI providers for code generation.

## Examples

### 1. Contextual Grounding

When a node requires a user to "Click the first available size in the dropdown", the system:

1. Navigates to the page.
2. Captures the current DOM and accessibility tree.
3. Identifies that the "Size" dropdown contains `["S", "M", "L"]` with "S" being available.
4. Generates code specific to that real-time state: `await page.click('text=S');`

### 2. Iterative Refinement (Self-Correction)

If the AI generates code to click a button using an ID that has changed:

1. The engine runs the code: `await page.click('#old-login-btn');`
2. Playwright throws a `TimeoutError`.
3. The engine captures the error and the new DOM state.
4. The engine sends this back to the AI: "The button with ID `#old-login-btn` was not found. Here is the new DOM."
5. The AI corrects the logic: `await page.click('.new-primary-login');`
