# 010 - Dynamic Test Path Generation and Representation

## Context

In Provar, tests are represented as visual graphs (`PDR 002`) and executed as linear paths resolved from the graph. Previously, compiled tests generated hard-coded, static string names (e.g., `"Path 1: Login -> Add to Cart"`).

Statically baking path names into compiled execution files creates several product-level challenges:
1. **Name Brittleness**: If a developer renames a node's title in the visual editor (e.g., changing `"Login"` to `"Sign In"`), the compiled test path name becomes out of sync until a manual compilation occurs, leading to mismatched execution reports and logs.
2. **Asset Decoupling**: If visual assets (like accepted screenshots) rely on slugified path names, a simple action title rename would break the path's directory naming, separating the test from its historical baselines.
3. **Redundancy**: Path names are fully derivative of the sequence of actions that comprise them. Storing them as static parameters in code is redundant.

We need a stable product model that separates a test path's immutable **Identity** (used for asset storage, comparison, and reporting) from its human-readable **Representation** (used for displaying logs, dashboards, and reports).

## Decision

We will introduce a product design model for **Dynamic Test Path Generation and Representation**:

### 1. Dynamic Path Naming
Test path display names will be generated dynamically at runtime based on the sequence of action titles making up the execution path.
- The compiled TypeScript code will omit path names completely, utilizing a single-parameter signature: `test([action_v2b3n, action_k1l2m])`.
- In test runners, logs, and reporting dashboards, the path name will be rendered in real-time by joining the action titles using a standard separator (e.g., `" -> "`).
- *Example*: A path with actions titled `"Open App"`, `"Login"`, and `"Checkout"` will render as `"Open App -> Login -> Checkout"`.

### 2. Deterministic Path IDs
Each resolved execution path will be uniquely identified by a **Test Path ID** constructed by joining the sequential action IDs in order, separated by hyphens. To keep these IDs clean, any generic framework prefixes (such as `action_`) will be stripped.
- *Example*: A path running `action_v2b3n` followed by `action_k1l2m` will have the unique Path ID `v2b3n-k1l2m`.
- The Path ID serves as the immutable key for all historical data, visual screenshots, and metrics related to that specific path.

## Consequences

- **Instant Visual Synchronization**: Renaming an action node's title immediately updates the display name of all affected paths across all logs and interfaces without requiring a compiler run or invalidating visual test history.
- **Stable Visual Assertions**: Because path identities are tied directly to immutable action node IDs instead of user-facing titles, teams can refactor node names safely without losing or corrupting accepted visual states.
- **Cleaner Generated Code**: Stripping string names from the generated code reduces file sizes, makes files easier to read, and keeps the compilation target focused entirely on execution logic.
