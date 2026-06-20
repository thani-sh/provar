import { ProvarAPI } from "../api/provar";
import {
  addNodeToGraph,
  updateNodeInGraph,
  deleteNodeFromGraph,
  toEngineTasks,
} from "../utils/graph";
import { buildGraphPaths } from "@libs/engine";
import type { Path } from "@libs/domain";
import type { TestFile, TestNode } from "@libs/domain/zod";
import type { TaskState } from "../canvas/constants";
import { projectStore } from "./project-store.svelte";
import { uiStore } from "./ui-store.svelte";

/**
 * EditorStore manages the active file, code generation status, and test execution runner.
 */
class EditorStore {
  currentFile = $state<TestFile | null>(null);
  selectedFilePath = $state<string | null>(null);
  selectedNodeId = $state<string | null>(null);

  isRunning = $state(false);
  isCompiling = $state(false);
  compilationStates = $state<
    Record<string, "compiling" | "compiled" | "failed" | "idle">
  >({});

  /**
   * taskPathStates tracks the execution result of each node per path index.
   * Structure: { [nodeId]: { [pathIndex]: "idle" | "running" | "success" | "failed" } }
   */
  taskPathStates = $state<
    Record<string, Record<number, "idle" | "running" | "success" | "failed">>
  >({});

  /**
   * taskStates derives the effective display state per node by aggregating
   * all path results. A node is "mixed" when it succeeded on some paths and
   * failed on others.
   */
  taskStates = $derived.by<Record<string, TaskState>>(() => {
    const result: Record<string, TaskState> = {};

    if (this.isCompiling || Object.keys(this.compilationStates).length > 0) {
      for (const [nodeId, state] of Object.entries(this.compilationStates)) {
        if (state === "compiling") {
          result[nodeId] = "compiling";
        } else if (state === "compiled") {
          result[nodeId] = "compiled";
        } else if (state === "failed") {
          result[nodeId] = "failed";
        } else {
          result[nodeId] = "idle";
        }
      }
      if (this.currentFile?.graph?.nodes) {
        for (const id of Object.keys(this.currentFile.graph.nodes)) {
          if (!result[id]) {
            result[id] = "idle";
          }
        }
      }
      return result;
    }

    for (const [nodeId, pathResults] of Object.entries(this.taskPathStates)) {
      const states = Object.values(pathResults);
      if (states.includes("running")) {
        result[nodeId] = "running";
      } else {
        const hasSuccess = states.includes("success");
        const hasFailed = states.includes("failed");
        if (hasSuccess && hasFailed) result[nodeId] = "mixed";
        else if (hasFailed) result[nodeId] = "failed";
        else if (hasSuccess) result[nodeId] = "success";
        else result[nodeId] = "idle";
      }
    }
    return result;
  });
  screenshots = $state<Record<string, { baseline?: string; current?: string }>>(
    {},
  );

  /**
   * nodeGeneratedCode caches the extracted compiled-code source per node
   * id, plus a staleness flag. The map is keyed by nodeId; the flag tells
   * the side panel whether to show the code or a "recompile first" hint.
   */
  nodeGeneratedCode = $state<
    Record<string, { code: string | null; upToDate: boolean }>
  >({});

  /**
   * inflightGeneratedCodeLoads tracks in-flight `loadGeneratedCodeForNode`
   * calls so a second call for the same node shares the in-progress
   * request instead of issuing a duplicate IPC.
   */
  private inflightGeneratedCodeLoads = new Set<string>();

  /** currentPathIndex tracks which path is currently being executed. */
  private currentPathIndex = $state(0);

  selectedNode = $derived.by(() => {
    if (!this.currentFile || !this.selectedNodeId) return null;
    return this.currentFile.graph.nodes[this.selectedNodeId] || null;
  });

  /** selectedNodePathIndex is the index of the path containing selectedNodeId, or null. */
  selectedNodePathIndex = $derived.by(() => {
    if (!this.currentFile || !this.selectedNodeId) return null;
    const paths = this.allPaths;
    const idx = paths.findIndex((p) =>
      p.tasks.some((t) => t.id === this.selectedNodeId),
    );
    return idx === -1 ? null : idx;
  });

  /** allPaths returns the engine's `Path[]` for the current file. */
  allPaths = $derived.by((): Path[] => {
    if (!this.currentFile) return [];
    return buildGraphPaths(
      this.currentFile.graph.start,
      toEngineTasks(this.currentFile.graph),
    );
  });

  /**
   * runningPathNodeIds is the set of node IDs that belong to the currently
   * executing path. Empty when no test is running.
   */
  runningPathNodeIds = $derived.by((): Set<string> => {
    if (!this.isRunning) return new Set();
    const path = this.allPaths[this.currentPathIndex];
    return path ? new Set(path.tasks.map((t) => t.id)) : new Set();
  });

  /**
   * compileCurrentTest triggers background TS/Playwright compilation for the active file.
   *
   * @param options.autoRun when true (default), the test file is automatically
   *   executed after a successful compile so the user can immediately verify
   *   the generated code actually works. Pass `{ autoRun: false }` for
   *   pure-recompile flows (e.g. the "Regenerate" menu) where the user just
   *   wants the TypeScript emitted without running it.
   */
  async compileCurrentTest(
    options: { autoRun?: boolean } = {},
  ): Promise<boolean> {
    if (!this.selectedFilePath) return false;
    const autoRun = options.autoRun ?? true;
    this.isCompiling = true;
    this.compilationStates = {};
    if (this.currentFile?.graph?.nodes) {
      for (const id of Object.keys(this.currentFile.graph.nodes)) {
        this.compilationStates[id] = "idle";
      }
    }

    try {
      const stream = ProvarAPI.compileTest(this.selectedFilePath);
      let success = false;
      for await (const event of stream) {
        if (event.type === "compile-started") {
          this.isCompiling = true;
          continue;
        }
        if (event.type === "compile-finished") {
          success = true;
          continue;
        }
        if (event.nodeId) {
          let stateVal: "compiling" | "compiled" | "failed" | "idle" = "idle";
          if (event.type === "node-started") {
            stateVal = "compiling";
          } else if (event.type === "node-succeeded") {
            stateVal = "compiled";
          } else if (event.type === "node-failed") {
            stateVal = "failed";
          }
          this.compilationStates = {
            ...this.compilationStates,
            [event.nodeId]: stateVal,
          };
        }
      }
      this.isCompiling = false;
      if (success) {
        // Recompile may have changed the source text for any node, so
        // drop the cached extracted code; the next panel open will
        // re-fetch and pick up the new version.
        this.nodeGeneratedCode = {};
        if (this.currentFile) {
          this.currentFile.code = { valid: true };
        }
      }
      // Verify the freshly compiled code by running every path right after a
      // successful compile. Errors during the run surface in the canvas as
      // per-node failures, so the user can see exactly which step broke.
      // We deliberately do not `await` this — the run can take a while and
      // the UI should remain responsive. `runAllPaths` itself is a no-op
      // when `isRunning` is true, so re-entrancy is safe.
      if (success && autoRun && this.currentFile) {
        void this.runAllPaths();
      }
      return success;
    } catch (e) {
      console.error("EditorStore: Compile failed:", e);
      this.isCompiling = false;
      return false;
    }
  }

  /** runAllPaths runs every path in the file sequentially, accumulating results. */
  async runAllPaths(): Promise<void> {
    if (!this.selectedFilePath || this.isRunning) return;
    if (!this.currentFile?.code?.valid) {
      alert(
        "Cannot run test: compiled code is missing or invalid. Please compile first.",
      );
      return;
    }
    this.taskPathStates = {};
    const paths = this.allPaths;
    for (let i = 0; i < paths.length; i++) {
      await this.runPath(i);
    }
  }

  private async runStream(stream: ReadableStream<any>) {
    try {
      for await (const event of stream) {
        if (event.type === "run-started") {
          this.isRunning = true;
          this.compilationStates = {};
          if (this.currentFile?.graph?.nodes) {
            const updated = { ...this.taskPathStates };
            for (const id of Object.keys(this.currentFile.graph.nodes)) {
              updated[id] = {
                ...(updated[id] || {}),
                [this.currentPathIndex]: "idle",
              };
            }
            this.taskPathStates = updated;
          }
          continue;
        }

        if (event.type === "run-finished") {
          this.isRunning = false;
          continue;
        }

        switch (event.type) {
          case "task-started":
            if (event.taskId) {
              this.taskPathStates = {
                ...this.taskPathStates,
                [event.taskId]: {
                  ...(this.taskPathStates[event.taskId] || {}),
                  [this.currentPathIndex]: "running",
                },
              };
            }
            break;
          case "task-finished":
            if (event.taskId) {
              this.taskPathStates = {
                ...this.taskPathStates,
                [event.taskId]: {
                  ...(this.taskPathStates[event.taskId] || {}),
                  [this.currentPathIndex]: "success",
                },
              };
              this.loadScreenshotsForNode(event.taskId);
            }
            break;
          case "task-failed":
            if (event.taskId) {
              this.taskPathStates = {
                ...this.taskPathStates,
                [event.taskId]: {
                  ...(this.taskPathStates[event.taskId] || {}),
                  [this.currentPathIndex]: "failed",
                },
              };
              this.loadScreenshotsForNode(event.taskId);
            }
            break;
          case "visual-comparison-triggered":
            if (event.taskId) {
              this.loadScreenshotsForNode(event.taskId);
            }
            break;
        }
      }
    } catch (e) {
      console.error("EditorStore: Run stream failed:", e);
    } finally {
      this.isRunning = false;
    }
  }

  /** runPath triggers execution of a single path. */
  async runPath(pathIndex: number): Promise<void> {
    if (!this.selectedFilePath || this.isRunning) return;
    if (!this.currentFile?.code?.valid) {
      alert(
        "Cannot run test: compiled code is missing or invalid. Please compile first.",
      );
      return;
    }
    this.currentPathIndex = pathIndex;
    const stream = ProvarAPI.runTestPath(
      this.selectedFilePath!,
      pathIndex,
      undefined,
      true,
    );
    await this.runStream(stream);
  }

  /** runPathUpTo runs a path stopping execution at the given task node. */
  async runPathUpTo(pathIndex: number, upToTaskId: string): Promise<void> {
    if (!this.selectedFilePath || this.isRunning) return;
    if (!this.currentFile?.code?.valid) {
      alert(
        "Cannot run test: compiled code is missing or invalid. Please compile first.",
      );
      return;
    }
    this.currentPathIndex = pathIndex;
    const stream = ProvarAPI.runTestPath(
      this.selectedFilePath!,
      pathIndex,
      upToTaskId,
      true,
    );
    await this.runStream(stream);
  }

  /** clearRunStates removes all per-path execution results from the display. */
  clearRunStates(): void {
    this.taskPathStates = {};
  }

  /**
   * loadScreenshotsForNode retrieves baseline and current screenshot assets for a node.
   */
  async loadScreenshotsForNode(nodeId: string): Promise<void> {
    if (!this.selectedFilePath) return;
    try {
      const res = await ProvarAPI.getScreenshots(
        this.selectedFilePath,
        0,
        nodeId,
      );
      this.screenshots[nodeId] = {
        baseline: res.baseline,
        current: res.current,
      };
    } catch (e) {
      console.error("EditorStore: Failed to get screenshots:", e);
    }
  }

  /**
   * loadGeneratedCodeForNode fetches the compiled code for a single node
   * and stores it in `nodeGeneratedCode`. The result is `upToDate: false`
   * when the YAML has changed since the last compile — the side panel
   * surfaces that as a "recompile first" hint rather than showing stale
   * code. Concurrent calls for the same node are deduped.
   */
  async loadGeneratedCodeForNode(nodeId: string): Promise<void> {
    if (!this.selectedFilePath) return;
    if (this.inflightGeneratedCodeLoads.has(nodeId)) return;
    this.inflightGeneratedCodeLoads.add(nodeId);
    try {
      const res = await ProvarAPI.getNodeGeneratedCode(
        this.selectedFilePath,
        nodeId,
      );
      this.nodeGeneratedCode = {
        ...this.nodeGeneratedCode,
        [nodeId]: res,
      };
    } catch (e) {
      console.error("EditorStore: Failed to get generated code:", e);
      this.nodeGeneratedCode = {
        ...this.nodeGeneratedCode,
        [nodeId]: { code: null, upToDate: false },
      };
    } finally {
      this.inflightGeneratedCodeLoads.delete(nodeId);
    }
  }

  /**
   * acceptVisualStateForNode promotes the current screenshot of a node to baseline.
   */
  async acceptVisualStateForNode(nodeId: string): Promise<void> {
    if (!this.selectedFilePath) return;
    try {
      const res = await ProvarAPI.acceptVisualState(
        this.selectedFilePath,
        0,
        nodeId,
      );
      if (res.success) {
        await this.loadScreenshotsForNode(nodeId);
      } else {
        alert("Failed to promote baseline screenshot.");
      }
    } catch (e) {
      console.error("EditorStore: Promote baseline error:", e);
    }
  }

  /**
   * loadFile reads the test file contents and updates the project editor state.
   */
  async loadFile(path: string): Promise<void> {
    this.selectedFilePath = path;
    const res = await ProvarAPI.readFile(path);
    this.currentFile = res.content;
    this.selectedNodeId = null;
    this.taskPathStates = {};
    this.compilationStates = {};
    this.screenshots = {};
    this.nodeGeneratedCode = {};
    if (this.currentFile?.graph?.nodes) {
      for (const id of Object.keys(this.currentFile.graph.nodes)) {
        this.loadScreenshotsForNode(id);
      }
    }
  }

  /**
   * closeFile closes the current active test file in the editor project.
   */
  async closeFile(): Promise<void> {
    this.selectedFilePath = null;
    this.currentFile = null;
    this.selectedNodeId = null;
  }

  /**
   * saveFile serializes the active test file graph and updates the disk storage.
   */
  async saveFile(): Promise<void> {
    if (!this.selectedFilePath || !this.currentFile) return;
    await ProvarAPI.writeFile(this.selectedFilePath, this.currentFile);
  }

  /**
   * addNode appends a new task node between fromId and toId in the test file.
   */
  async addNode(fromId: string | null, toId: string | null): Promise<void> {
    if (!this.currentFile) return;
    const { file, newNodeId } = addNodeToGraph(
      $state.snapshot(this.currentFile),
      fromId,
      toId,
    );
    this.currentFile = file;
    this.selectedNodeId = newNodeId;
    await this.saveFile();
  }

  /**
   * updateNode merges updates into the specified task node state.
   */
  async updateNode(id: string, updates: Partial<TestNode>): Promise<void> {
    if (!this.currentFile) return;
    this.currentFile = updateNodeInGraph(
      $state.snapshot(this.currentFile),
      id,
      updates,
    );
    await this.saveFile();
  }

  /**
   * deleteNode removes a node and all of its descendant execution branches.
   */
  async deleteNode(id: string): Promise<void> {
    if (!this.currentFile) return;
    const file = this.currentFile;

    uiStore.openConfirmModal(
      "Delete Task Node",
      "Are you sure you want to delete this node and all its descendants?",
      async () => {
        this.currentFile = deleteNodeFromGraph($state.snapshot(file), id);
        this.selectedNodeId = null;
        await this.saveFile();
      },
    );
  }

  /**
   * createFile creates a new test graph file under the specified project subdirectory.
   */
  async createFile(dir: string, name: string): Promise<void> {
    const path = `${dir}/${name}.test.yml`;
    const res = await ProvarAPI.createFile(path, name);
    if (res.success) {
      await projectStore.refreshFiles();
      await this.loadFile(path);
    }
  }

  /**
   * createDirectory creates a new directory folder in the project.
   */
  async createDirectory(path: string): Promise<void> {
    const res = await ProvarAPI.createDirectory(path);
    if (res.success) {
      await projectStore.refreshFiles();
    }
  }

  /**
   * deletePath deletes a directory or test file path from disk.
   */
  async deletePath(path: string): Promise<void> {
    console.log("[EditorStore] deletePath called with:", path);
    const isFolder = !path.endsWith(".yml");
    const typeLabel = path.endsWith(".test.yml") ? "test" : "folder";

    uiStore.openConfirmModal(
      `Delete ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}`,
      `Are you sure you want to delete this ${typeLabel}? This action cannot be undone.`,
      async () => {
        console.log("[EditorStore] calling ProvarAPI.deletePath:", path);
        const res = await ProvarAPI.deletePath(path);
        console.log("[EditorStore] ProvarAPI.deletePath result:", res);
        if (res.success) {
          if (
            this.selectedFilePath === path ||
            (isFolder && this.selectedFilePath?.startsWith(path))
          ) {
            this.closeFile();
          }
          await projectStore.refreshFiles();
        }
      },
    );
  }
}

/**
 * editorStore is the shared reactive state instance of EditorStore.
 */
export const editorStore = new EditorStore();
