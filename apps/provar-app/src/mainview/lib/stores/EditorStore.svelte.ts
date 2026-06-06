import { registerRPCHandlers } from "../api/rpc";
import { ProvarAPI } from "../api/provar";
import {
  addNodeToGraph,
  updateNodeInGraph,
  deleteNodeFromGraph,
} from "../utils/graph";
import type { TestFile, TestNode } from "@libs/domain/zod";
import { enumeratePaths } from "../../../shared/utils";
import type { TaskState } from "../canvas/constants";
import { workspaceStore } from "./WorkspaceStore.svelte";
import { uiStore } from "./UIStore.svelte";

class EditorStore {
  currentFile = $state<TestFile | null>(null);
  selectedFilePath = $state<string | null>(null);
  selectedNodeId = $state<string | null>(null);

  isRunning = $state(false);
  isCompiling = $state(false);

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

  /** runFinishedResolve is set by runPath and called when run-finished fires. */
  private runFinishedResolve: (() => void) | null = null;

  /** currentPathIndex tracks which path is currently being executed. */
  private currentPathIndex = $state(0);

  selectedNode = $derived.by(() => {
    if (!this.currentFile || !this.selectedNodeId) return null;
    return this.currentFile.graph.nodes[this.selectedNodeId] || null;
  });

  /** selectedNodePathIndex is the index of the path containing selectedNodeId, or null. */
  selectedNodePathIndex = $derived.by(() => {
    if (!this.currentFile || !this.selectedNodeId) return null;
    const paths = enumeratePaths(this.currentFile.graph);
    const idx = paths.findIndex((p) => p.includes(this.selectedNodeId!));
    return idx === -1 ? null : idx;
  });

  /** allPaths returns the enumerated execution paths for the current file. */
  allPaths = $derived.by(() => {
    if (!this.currentFile) return [];
    return enumeratePaths(this.currentFile.graph);
  });

  /**
   * runningPathNodeIds is the set of node IDs that belong to the currently
   * executing path. Empty when no test is running.
   */
  runningPathNodeIds = $derived.by((): Set<string> => {
    if (!this.isRunning) return new Set();
    const path = this.allPaths[this.currentPathIndex];
    return path ? new Set(path) : new Set();
  });

  constructor() {
    registerRPCHandlers({
      testRunEvent: (event) => {
        console.log(
          "[EditorStore] Received testRunEvent:",
          event.type,
          "taskId:",
          event.taskId,
          "isRunning before:",
          this.isRunning,
        );

        if (event.type === "run-started") {
          this.isRunning = true;
          // Reset this path's slot for all known nodes; other paths are preserved.
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
          console.log("[EditorStore] isRunning updated to:", this.isRunning);
          return;
        }

        if (event.type === "run-finished") {
          this.isRunning = false;
          console.log("[EditorStore] isRunning updated to:", this.isRunning);
          this.runFinishedResolve?.();
          this.runFinishedResolve = null;
          return;
        }

        if (!this.currentFile) {
          console.warn(
            "[EditorStore] Warning: currentFile is not loaded, skipping task state updates",
          );
          return;
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
      },
    });
  }

  async compileCurrentTest() {
    if (!this.selectedFilePath) return;
    this.isCompiling = true;
    try {
      const res = await ProvarAPI.compileTest(this.selectedFilePath);
      this.isCompiling = false;
      if (res.success && this.currentFile) {
        this.currentFile.code = { valid: true };
      }
      return res.success;
    } catch (e) {
      console.error("EditorStore: Compile failed:", e);
      this.isCompiling = false;
      return false;
    }
  }

  /** runAllPaths runs every path in the file sequentially, accumulating results. */
  async runAllPaths() {
    if (!this.selectedFilePath || this.isRunning) return;
    if (!this.currentFile?.code?.valid) {
      alert(
        "Cannot run test: compiled code is missing or invalid. Please compile first.",
      );
      return;
    }
    // Clear all prior results so multi-path accumulation starts fresh.
    this.taskPathStates = {};
    const paths = this.allPaths;
    for (let i = 0; i < paths.length; i++) {
      await this.runPath(i);
    }
  }

  /** runPath runs a single path by its index and resolves when execution finishes. */
  async runPath(pathIndex: number): Promise<void> {
    if (!this.selectedFilePath || this.isRunning) return;
    if (!this.currentFile?.code?.valid) {
      alert(
        "Cannot run test: compiled code is missing or invalid. Please compile first.",
      );
      return;
    }
    this.currentPathIndex = pathIndex;
    this.isRunning = true;

    return new Promise(async (resolve) => {
      // Store resolve so the run-finished RPC event can unblock the caller.
      this.runFinishedResolve = resolve;

      try {
        const res = await ProvarAPI.runTestPath(
          this.selectedFilePath!,
          pathIndex,
          undefined,
          true,
        );
        if (!res.success) {
          this.isRunning = false;
          this.runFinishedResolve = null;
          resolve();
          alert(`Test execution failed to start: ${res.error}`);
        }
      } catch (e) {
        console.error("EditorStore: Run failed:", e);
        this.isRunning = false;
        this.runFinishedResolve = null;
        resolve();
      }
    });
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
    this.isRunning = true;

    return new Promise(async (resolve) => {
      this.runFinishedResolve = resolve;

      try {
        const res = await ProvarAPI.runTestPath(
          this.selectedFilePath!,
          pathIndex,
          upToTaskId,
          true,
        );
        if (!res.success) {
          this.isRunning = false;
          this.runFinishedResolve = null;
          resolve();
          alert(`Test execution failed to start: ${res.error}`);
        }
      } catch (e) {
        console.error("EditorStore: Run failed:", e);
        this.isRunning = false;
        this.runFinishedResolve = null;
        resolve();
      }
    });
  }

  /** clearRunStates removes all per-path execution results from the display. */
  clearRunStates() {
    this.taskPathStates = {};
  }

  async loadScreenshotsForNode(nodeId: string) {
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

  async acceptVisualStateForNode(nodeId: string) {
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

  async loadFile(path: string) {
    this.selectedFilePath = path;
    const res = await ProvarAPI.readFile(path);
    this.currentFile = res.content;
    this.selectedNodeId = null;
    this.taskPathStates = {};
    this.screenshots = {};
    if (this.currentFile?.graph?.nodes) {
      for (const id of Object.keys(this.currentFile.graph.nodes)) {
        this.loadScreenshotsForNode(id);
      }
    }
  }

  async closeFile() {
    this.selectedFilePath = null;
    this.currentFile = null;
    this.selectedNodeId = null;
  }

  async saveFile() {
    if (!this.selectedFilePath || !this.currentFile) return;
    await ProvarAPI.writeFile(this.selectedFilePath, this.currentFile);
  }

  async addNode(fromId: string | null, toId: string | null) {
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

  async updateNode(id: string, updates: Partial<TestNode>) {
    if (!this.currentFile) return;
    this.currentFile = updateNodeInGraph(
      $state.snapshot(this.currentFile),
      id,
      updates,
    );
    await this.saveFile();
  }

  async deleteNode(id: string) {
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

  async createFile(dir: string, name: string) {
    const path = `${dir}/${name}.test.yml`;
    const res = await ProvarAPI.createFile(path, name);
    if (res.success) {
      await workspaceStore.refreshFiles();
      await this.loadFile(path);
    }
  }

  async createDirectory(path: string) {
    const res = await ProvarAPI.createDirectory(path);
    if (res.success) {
      await workspaceStore.refreshFiles();
    }
  }

  async deletePath(path: string) {
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
          await workspaceStore.refreshFiles();
        }
      },
    );
  }
}

export const editorStore = new EditorStore();
