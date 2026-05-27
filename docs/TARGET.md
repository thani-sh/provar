# @libs/agents

Client Orchestration:

 - `function: createClient(provider: 'gemini-cli' | 'copilot-cli'): Client` - Creates a generic, protocol-agnostic client for the given provider.
 - `interface: Client`
    - `async session(): Promise<Session>` - Spawns a new session with the agent (same interface across all providers).
    - `async close(): Promise<void>` - Safely closes the connection and shuts down the underlying agent subprocess.
 - `interface: Session`
    - `async prompt(stuff: Attachment[]): AsyncGenerator<Attachment, void>` - Prompts the agent with attachments (e.g. text, source code, screenshots) and yields response chunks.
 - `interface: Attachment` - Protocol-agnostic union representing all attachment payloads (Text, Code, Screenshot, etc.).

---

# @libs/domain

Core Data Structures:

 - `interface: Project` - Represents the root Provar workspace directory.
    - `property: path: string` - Absolute path to the `.provar` workspace directory.
    - `property: variables: Record<string, string>` - Globally defined project environment variables.
    - `property: files: File[]` - List of all test files found in the project workspace.

Test Graph Models:

 - `interface: Graph` - Represents the topology of a test graph (reusable for both main files and nested task graphs).
    - `property: info: string` - Human-readable description of what this graph represents.
    - `property: start: string` - Starting task ID within the graph.
    - `property: tasks: Record<string, Task>` - Map of task nodes inside the graph.
    - `property: paths: Path[]` - Array of resolved linear execution paths within this graph.

 - `interface: File` - Extends `Graph` to represent a physical test file in the workspace (e.g., `*.test.yml`).
    - `property: name: string` - High-level name of the test file.
    - `property: path: string` - Absolute file system path to the test file.

 - `interface: Path` - Represents a resolved sequence of tasks executed linearly from start to terminal nodes.
    - `property: tasks: Task[]` - List of tasks in the path in execution order.

 - `interface: Task` - Represents a single step node in the test graph.
    - `property: id: string` - Unique identifier of the task.
    - `property: title: string` - Human-readable title of the step.
    - `property: info: string` - Detailed info description of what the step verifies.
    - `property: next: string[]` - List of next task IDs (normalized to an array; automatically coerced from strings in raw YAML).
    - `property: code?: string` - Generated source code for the task as a string if compiled.
    - `property: graph?: Graph` - Optional recursive nested graph representing a sub-scenario flow.

Zod Schemas:

All core domain interfaces are validated using Zod.
* Zod schemas must have a `schemaFor` prefix (e.g. `schemaForProject`, `schemaForFile`, `schemaForGraph`, `schemaForTask`, `schemaForPath`).
* All schemas are exported from the `@libs/domain/zod` sub-path.
* The parser must use Zod pre-processing to transparently coerce single-string `next` properties into strict `string[]` arrays.

---

# @libs/loader

> dependencies: @libs/domain

Project Workspace Loading:

- `function: loadProject(path: string): Promise<Project & ProjectLoader>` - Discovers, crawls, and loads the project from the given directory path.
- `interface: ProjectLoader`
    - `method: readFile(path: string): Promise<ExecutableFile>` - Reads and parses a specific test file, merging both declarative and executable layers.

Dynamic Runtime Models:

To execute files, the loader merges declarative YAML metadata with compiled TS functions into executable wrapper interfaces:

```ts
import type { TestAPI } from "@libs/executor";
import type { Task, File } from "@libs/domain";

export interface ExecutableTask extends Task {
  /**
   * The actual compiled JS/TS function loaded from the matching .test.ts module.
   */
  execute: (api: TestAPI) => Promise<void>;
}

export interface ExecutableFile extends File {
  /**
   * Override tasks to be executable in the runtime file wrapper.
   */
  tasks: Record<string, ExecutableTask>;
}
```

---

# @libs/executor

> dependencies: @libs/domain

Test Execution Engine:

- `function: execute(path: Path): Promise<Runner>` - Spawns Playwright and runs the given test path.

Execution Controller & States:

```ts
export interface Runner {
  /**
   * Returns the current snapshot state of the run.
   */
  getState(): RunnerState;

  /**
   * Streams execution events in real-time.
   */
  events(): AsyncGenerator<RunnerEvent, void>;

  /**
   * Pauses the run at the next task boundary.
   */
  pause(): Promise<void>;

  /**
   * Resumes a paused execution run.
   */
  resume(): Promise<void>;

  /**
   * Cancels the execution immediately and safely closes all open browser sessions.
   */
  cancel(): Promise<void>;

  /**
   * A promise that resolves when the execution is fully complete and cleaned up.
   */
  wait(): Promise<RunnerResult>;
}

export interface RunnerState {
  status: "idle" | "running" | "paused" | "success" | "failed" | "cancelled";
  current?: string;
  elapsed?: number;
  errors: Array<{ taskId: string; error: Error }>;
}

export type RunnerEvent =
  | { type: "run-started" }
  | { type: "task-started"; taskId: string; title: string }
  | { type: "task-finished"; taskId: string }
  | { type: "task-failed"; taskId: string; error: any }
  | { type: "visual-comparison-triggered"; taskId: string; screenshotBase64: string }
  | { type: "run-finished"; status: RunnerState["status"] };

export interface RunnerResult extends RunnerState {
  status: "success" | "failed" | "cancelled";
}

export interface TestAPI {
  /**
   * Playwright Page object
   */
  page: any;

  /**
   * Runtime variables injected from environment/config
   */
  var: Record<string, any>;

  /**
   * Shared test state across tasks in the path
   */
  state: Record<string, any>;
}
```

---

# !! IMPORTANT !!

## Code Generation Specification

The `@libs/compiler` will produce a clean, decoupled `.test.ts` file that does not contain runtime execution library wrappers or scenario metadata. Instead, the compiled file serves strictly as an executable repository of flat tasks and path maps.

The compiler and loader will read both the `.test.yml` file (for metadata and structural references) and the `.test.ts` file (for compiled test code) at runtime.

### Generated Format

```ts
// hash: <yml-file-sha-hash>
import type { TestAPI } from "@libs/executor";

export const tasks = {
   ['<task-id-1>']: async (api: TestAPI) => {
      // eg: await api.page.locator('button#submit').click();
   },
   ['<task-id-2>']: async (api: TestAPI) => {
      // eg: await api.page.locator('input#username').fill(api.var.username);
   },
}

export const paths = [
   ['<task-id-1>', '<task-id-2>', ...],
];
```
