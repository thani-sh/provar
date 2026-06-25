# 009 - Screenshot Storage and Accepted Comparison

## Context

In Provar, tests are defined as visual graphs (`002`) and compiled into isolated, linear execution paths representing distinct user journeys (`007`). These resolved paths are executed using Playwright (`001`).

During test execution, we need to capture the visual state of the web application after each task is executed. Capturing screenshots is crucial for:
- **Visual Regression Testing**: Detecting unexpected UI changes and visual regressions.
- **Debugging & Audit Trails**: Reviewing exactly what the application looked like during a test failure or success.
- **Contextual Grounding**: Providing real-time visual and DOM state to the AI code generation and repair pipelines (`003`).

To support these goals, we need a robust, standardized filesystem directory structure and file naming convention inside the `.provar/` directory (`006`). This convention must:
1. Support distinct branching test paths resolved from the same parent test graph.
2. Group screenshots chronologically by execution order.
3. Manage distinct lifecycles and modifiers: **Accepted** (the accepted golden visual state), **Current** (the transient results of the latest test run), **Diff** files highlighting visual mismatches, and optional **Masks** to ignore dynamic or high-churn areas.
4. Align with Git-native storage workflows (`006`) so that accepted states and masks can be versioned and branched easily.

## Decision

We will store execution screenshots in a structured, hierarchical format under the `.provar/screenshots/` directory, separating them into distinct lifecycles/modifiers, supporting optional masking, and utilizing a strict path-based naming convention.

### 1. Lifecycles, Modifiers, and Directory Separation

We will partition the `.provar/screenshots/` folder into four distinct directories corresponding to their roles:

- **`.provar/screenshots/accepted/` (Committed to Git)**:
  - Stores the "accepted/correct" visual state (the golden master).
  - These files **must be checked into version control (Git)**. This ensures that visual accepted states naturally branch, merge, and evolve alongside the code and test configurations.
- **`.provar/screenshots/masks/` (Committed to Git)**:
  - Optionally stores black-and-white binary mask images used to ignore specific portions of a screenshot during comparison (e.g., dynamic elements, random IDs, or changing timestamps).
  - These files **must be checked into version control (Git)** so the entire development team shares the same exclusions.
  - The relative file path and image dimensions must exactly match the corresponding screenshot in the `accepted/` directory.
  - The mask image must only use two colors:
    - **Black (`#000000`)**: Ignores the pixel/region. Before performing the comparison, the executor will paint over these regions with a uniform color in both `accepted` and `current` screenshots.
    - **White (`#ffffff`)**: Compares the region normally.
- **`.provar/screenshots/current/` (Git-Ignored)**:
  - Stores screenshots captured during the latest local or CI test execution.
  - This directory is transient and **must be ignored by Git** (e.g., via `.provar/.gitignore` or the root `.gitignore`).
- **`.provar/screenshots/diff/` (Git-Ignored)**:
  - Stores overlay diff images highlighting the differences between `current` and `accepted` when a visual assertion failure occurs.
  - This directory is transient and **must be ignored by Git**.

### 2. Path Hierarchy and Naming Convention

Because a single test graph can contain nested sub-graphs (`006`), subfolders under `tests/`, and multiple resolved branching paths (`007`), we will structure the screenshots hierarchically to avoid collisions and preserve readability:

```
.provar/screenshots/<state>/<relative-test-path>/<path-name-slug>/<step-index>_<task-id>.png
```

#### Parameters:
- **`<state>`**: `accepted`, `masks`, `current`, or `diff`.
- **`<relative-test-path>`**: The relative folder hierarchy and file name of the test definition file under `.provar/tests/` (excluding the `.test.yml` extension).
  - *Example*: For `.provar/tests/auth/login.test.yml`, this maps to `auth/login`.
- **`<path-name-slug>`**: Constructed by joining the task IDs in order (excluding any `task_` prefix) separated by hyphens. This provides a highly deterministic, stable directory name that remains consistent even if dynamic test/path names are changed or generated differently.
  - *Example*: For a path executing tasks with IDs `task_v2b3n` and `task_k1l2m`, this maps to `v2b3n-k1l2m`.
- **`<step-index>`**: A 3-digit zero-padded index indicating the chronological execution order of the task within the path (e.g., `001`, `002`, `003`). This ensures alphabetical file sorting matches actual execution order.
- **`<task-id>`**: The unique 5-character string ID of the task node from the graph.
  - *Example*: `v2b3n`.

#### Example Structure:
```
.provar/
└── screenshots/
    ├── accepted/
    │   └── auth/
    │       └── login/
    │           └── v2b3n-k1l2m/
    │               ├── 001_v2b3n.png
    │               └── 002_k1l2m.png
    ├── masks/
    │   └── auth/
    │       └── login/
    │           └── v2b3n-k1l2m/
    │               └── 002_k1l2m.png  (optional: masks out dynamic content, e.g. a token or timestamp)
    ├── current/
    │   └── auth/
    │       └── login/
    │           └── v2b3n-k1l2m/
    │               ├── 001_v2b3n.png
    │               └── 002_k1l2m.png
    └── diff/
        └── auth/
            └── login/
                └── v2b3n-k1l2m/
                    └── 002_k1l2m.png  (only exists if a visual regression was detected)
```

### 3. Comparison and Approval Workflow

1. **Test Execution**: The Playwright-based test executor executes the tasks in a path. After each task completes, it takes a screenshot and saves it in `.provar/screenshots/current/...`.
2. **Visual Comparison**:
   - The executor inspects the task node's metadata for the `visualCompare` flag (which compiles down from the visual graph definition as described in `PDR 009`).
   - If `visualCompare` is explicitly set to `false`, **the visual comparison and assertion phase is entirely skipped** for this step. The screenshot is kept under `current/` for audit logs and AI grounding, but visual differences will never fail the test execution.
   - If `visualCompare` is `true` (or is omitted, defaulting to `true`):
     - The executor checks if a corresponding screenshot exists in `accepted/`.
     - If an accepted state **does not exist**, the comparison is marked as "pending accepted state" (the step passes, but notifies the user to establish an accepted state).
     - If an accepted state **does exist**, the executor checks if a corresponding mask exists in `masks/`.
       - If a mask is present, the executor paints over all black-masked pixels (`#000000`) with a uniform solid color (e.g., solid black or solid white) on both the `accepted` and `current` images before proceeding.
     - The executor then compares the (potentially masked) `current` screenshot against the (potentially masked) `accepted` screenshot using a visual regression utility (e.g., `pixelmatch` or similar) with a configurable pixel difference threshold (default: `0.1%`).
     - If the difference exceeds the threshold, a diff image highlighting the mismatch is written to `diff/`, and the test step is marked as **failed due to visual deviation**.
3. **Review & Approval**:
   - The Electrobun-based desktop application (`008`) or the Provar CLI displays the visual diff side-by-side.
   - If the UI change is a bug, the developer fixes the codebase.
   - If the UI change is intentional, the developer clicks "Accept State" in the editor (or runs `bun run provar approve`), which copies the screenshot from `current/` to `accepted/` and deletes the transient diff in `diff/`.
4. **Commit**: The developer commits the updated files in `accepted/` (and any new or modified masks in `masks/`) to Git.

## Consequences

- **Git-Native Visual Workflows**: Because accepted states and mask definitions are stored under the standard `.provar` directory, teams gain PR-level visual regression reviews, branch merging for UI changes, and automated CI visual checks for free.
- **Zero-Collision Organization**: Fully namespace-isolating by file directory, resolved path slug, and step index guarantees that branching paths never collide or overwrite each other's visual states.
- **Efficient Disk and Version History**: Ignoring `current` and `diff` directories prevents large amounts of transient execution assets from polluting the user's Git repository.
- **Dynamic Content Handling**: Support for black-and-white masking enables robust visual tests that do not fail on dynamic content such as dates, user-generated content, or high-variance loading indicators.
- **Streamlined Desktop UI integration**: Provar Editor can easily locate and stream screenshots using direct file path matching based on the active test, path, and task ID.

## References

- Extends **001 - Use Playwright Execution Engine** (Playwright captures the post-task screenshots).
- Extends **006 - Git-Native Storage Conventions** (Defines `.provar` as the single source of truth and establishes the file system layout).
- Extends **007 - Automated Path Resolution for Branching** (Organizes screenshot collections by resolved linear test path).
- Complements **008 - Use Electrobun for Desktop Application** (Enables local-first rendering, diffing, and accepted state/mask approval in the Provar Editor interface).
