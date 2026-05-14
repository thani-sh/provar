# 008 - Provar Editor Desktop Application

## Context

While Provar's core execution engine is designed to be CLI-first and CI-friendly, the process of creating and maintaining graph-based tests requires a highly visual and interactive interface. A web-based editor (SaaS) introduces friction regarding local filesystem access, data privacy, and offline capabilities.

Users need a tool that:
- Allows them to visualize the flow of their tests.
- Provides immediate feedback during test construction.
- Integrates seamlessly with their local Git repositories.
- Operates entirely locally to ensure security and privacy of their test data.

## Decision

We will develop a dedicated desktop application called **Provar Editor**.

The Provar Editor will be the primary environment for:
- **Visual Graph Editing**: Creating and modifying test flows using a canvas-based interface.
- **Project Management**: Managing configurations, custom nodes, and test suites stored in the local `.provar` directory.
- **Local Debugging**: Running and debugging tests directly from the editor with real-time feedback.
- **Asset Management**: Managing screenshots, recordings, and other artifacts generated during test execution.

## Consequences

- **Local Sovereignty**: All test definitions and data remain on the user's machine, aligning with PDR-003.
- **Developer Workflow**: The editor acts as a companion to the developer's IDE, operating directly on the project's source files.
- **Rich Experience**: By building a desktop app, we can provide a more responsive and integrated UI than what is possible in a browser-only environment.
- **Ease of Use**: The visual nature of the editor lowers the barrier to entry for team members who may not be comfortable writing raw YAML or code for tests.
