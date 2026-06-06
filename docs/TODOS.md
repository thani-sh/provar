# Provar Architectural & Code Quality TODOs

This document contains a prioritized list of tasks to improve the codebase design, resolve DRY violations, and enforce SOLID software design principles across the monorepo.

---

## Completed Tasks

#### `TODO-001`: Centralize Browser Spawning (Completed)
* **Description:** Abstract Playwright browser and page creation out of compiler logic and delegate it entirely to the unified execution engine.
* **Resolution:** Merged `@libs/compiler` and `@libs/executor` into a single library package named `@libs/engine` (`libs/engine`), resolving package boundary coupling and implementing centralized page launching in `libs/engine/src/browser.ts`.

---

## Priority List

### Medium Priority

#### `TODO-002`: Reuse Loader's Code Validation Hash Check
* **Description:** Refactor `apps/provar-app/src/bun/index.ts` to rely on the validation hash status (`code.valid`) returned by `@libs/loader` instead of re-reading the files and calculating the hash manually.
* **Rationale:** Resolves duplicate file hash-checking logic and unnecessary disk reads (DRY violation).
* **Target:** `apps/provar-app/src/bun/index.ts`, `@libs/loader/src/index.ts`

#### `TODO-003`: Fix Task ID Generator Duplication & Fragility
* **Description:** Refactor `CreateFileCommand.ts` to import and reuse the robust `generateNodeId` utility from `shared/utils` instead of generating its own task IDs using `Math.random().toString(36).substring(2, 7)`.
* **Rationale:** Resolves copy-pasted ID generation and eliminates the risk of generating short/invalid random strings that fail Zod schema regex validation on load.
* **Target:** `apps/provar-app/src/bun/commands/CreateFileCommand.ts`, `apps/provar-app/src/shared/utils.ts`

#### `TODO-004`: Extract Screenshot-Saving Boilerplate
* **Description:** Extract screenshot directory creation and file writing logic into a shared utility function inside a helper in `@libs/engine`.
* **Rationale:** Resolves copy-pasted screenshot saving code duplicated three times across compiler and runner modules (DRY violation).
* **Target:** `libs/engine/src/TestRun.ts`, `libs/engine/src/compiler/generator.ts`

---

### Nice to Have

#### `TODO-005`: Refactor `ReadFileCommand` to Avoid Double Parsing
* **Description:** Refactor `ReadFileCommand` to retrieve the parsed file representation directly from `loadProject` or use the parser in `@libs/loader`, rather than loading the project and then re-reading/re-parsing the file separately using a different YAML parser.
* **Rationale:** Eliminates double filesystem access and parsing overhead on the same file.
* **Target:** `apps/provar-app/src/bun/commands/ReadFileCommand.ts`

#### `TODO-006`: Standardize YAML Parser Library
* **Description:** Standardize the entire monorepo on a single YAML parsing library.
* **Rationale:** Resolves having both `yaml` and `js-yaml` packages in the monorepo, decreasing workspace dependency clutter and ensuring uniform parsing behavior.
* **Target:** Monorepo package dependencies
