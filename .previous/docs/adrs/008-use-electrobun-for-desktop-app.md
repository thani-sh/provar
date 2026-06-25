# 008 - Use Electrobun for Desktop Application

## Context

Provar requires a desktop application to provide a rich, local-first editing experience for graph-based tests. The editor needs to handle complex visual interactions (the test graph) while maintaining direct access to the user's local filesystem and executing background tasks (like running Playwright tests).

## Decision

We will use **Electrobun** as the desktop application framework for `provar-editor`.

This choice aligns with our use of Bun throughout the project and allows us to:
- Write both frontend and backend logic in TypeScript/JavaScript.
- Leverage Bun's high-performance runtime and modern APIs.
- Utilize a lightweight native WebView (Chromium-based via CEF) for the frontend.
- Maintain a single codebase for the editor across different platforms.

## Consequences

- **Performance**: We benefit from Bun's fast startup times and efficient execution.
- **Ecosystem**: We can use any NPM package in both the UI and the backend.
- **Development Experience**: Electrobun provides a simple RPC mechanism between the Bun backend and the WebView frontend, making it easy to expose system-level functionality.
- **Lightweight**: The application footprint is smaller than a comparable Electron app.
- **Maturity**: Electrobun is a newer project, which may involve some "bleeding edge" challenges, but its architecture is well-suited for our needs.
