# 009 - Visual Diffing and Step-Level Assertions

## Context

Provar prioritizes a visual, AI-powered approach to end-to-end (E2E) testing (`PDR 001`). Standard DOM-based assertions (checking class names, element visibility, or texts) are brittle, hard to maintain, and fail to catch layout shifts, styling defects, or rendering anomalies. Visual assertions—comparing screenshot captures against an accepted golden state—provide much higher visual fidelity and confidence.

However, enforcing global visual assertions across an entire test path can lead to test flakiness and high maintenance overhead. Certain parts of a web application are inherently dynamic, volatile, or unstable by nature, such as:
- Third-party widgets (e.g., chat bubbles, cookie banners, advertisements).
- Dynamic feeds, news sections, or changing dates/timestamps.
- Video players, complex maps, or custom visualizations.

Forcing a global "all-or-nothing" approach to visual comparison restricts developers. We need a way to let developers granularly control where visual verification is enforced, without sacrificing visual logging, audit capabilities, or AI grounding contextual data.

## Decision

We will introduce **Granular Visual Assertions (Step-Level Control)** as a core product feature of Provar.

### 1. Step-Level Visual Diff Control
Developers will be able to enable or disable visual comparison for any individual task node directly in the test graph definition.

- **`visualCompare: true` (Default)**: The executor captures a screenshot, compares it against the accepted master state (optionally applying visual masks), and throws a visual assertion failure if a significant visual deviation is found.
- **`visualCompare: false`**: The executor still captures a screenshot of the step (saved to `.provar/screenshots/current/` for visual audit logs and AI grounding), but **completely skips the visual comparison/assertion phase**. A mismatch on this node will never fail the test path.

### 2. File Format and Compilation Representation
This setting will be stored directly on the task node inside the YAML graph definition and compiled down to the TypeScript executable code:

#### YAML Definition:
```yaml
nodes:
  task_v2b3n:
    title: "Login to account"
    info: "Navigate to login page"
    visualCompare: true # Enforced
    next: "task_k1l2m"
  task_k1l2m:
    title: "View activity feed"
    info: "Check user feed"
    visualCompare: false # Screenshot taken for audit/AI, but regression diffing skipped
```

#### Compiled TypeScript Output:
```typescript
export const tasks = {
  ["task_v2b3n"]: async (api: TestAPI) => {
    // ...
  },
  ["task_k1l2m"]: async (api: TestAPI) => {
    // ...
  },
};
```

### 3. Integrated Editing Experience
The Provar Editor desktop application (`PDR 008`) will provide a simple toggle in the side properties panel of each task node (e.g., "Enforce Visual Regression Check") to make modifying this flag intuitive for both developers and non-technical stakeholders.

## Consequences

- **Minimized Visual Flakiness**: Teams can bypass visual regression checks on highly dynamic sections of their app (like activity feeds or ads) while maintaining high-fidelity visual checks on static pages (like landing pages, checkout, and setup forms).
- **Comprehensive Visual Logs**: Even if comparison is disabled (`visualCompare: false`), a screenshot is still captured. This preserves a complete visual step-by-step audit trail for the entire test path, aiding debugging and contextual grounding for AI code repairs.
- **Optimal Balance of Tools**: Together with black-and-white masking (`ADR 009`), developers have a full suite of options for visual validation: full enforcement, localized masking, or total step bypass.
