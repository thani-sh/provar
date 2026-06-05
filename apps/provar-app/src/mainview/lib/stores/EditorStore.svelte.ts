import { registerRPCHandlers } from "../api/rpc";
import { ProvarAPI } from "../api/provar";
import {
  addNodeToGraph,
  updateNodeInGraph,
  deleteNodeFromGraph,
} from "../utils/graph";
import type { TestFile, TestNode } from "@libs/domain/zod";
import { enumeratePaths } from "../../../shared/utils";
import { workspaceStore } from "./WorkspaceStore.svelte";
import { uiStore } from "./UIStore.svelte";

class EditorStore {
  currentFile = $state<TestFile | null>(null);
  selectedFilePath = $state<string | null>(null);
  selectedNodeId = $state<string | null>(null);

  isRunning = $state(false);
  isCompiling = $state(false);
  taskStates = $state<
    Record<string, "idle" | "running" | "success" | "failed">
  >({});
  screenshots = $state<Record<string, { baseline?: string; current?: string }>>(
    {},
  );

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
          this.taskStates = {};
          if (this.currentFile?.graph?.nodes) {
            for (const id of Object.keys(this.currentFile.graph.nodes)) {
              this.taskStates[id] = "idle";
            }
          }
          console.log("[EditorStore] isRunning updated to:", this.isRunning);
          return;
        }

        if (event.type === "run-finished") {
          this.isRunning = false;
          console.log("[EditorStore] isRunning updated to:", this.isRunning);
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
              this.taskStates[event.taskId] = "running";
            }
            break;
          case "task-finished":
            if (event.taskId) {
              this.taskStates[event.taskId] = "success";
              this.loadScreenshotsForNode(event.taskId);
            }
            break;
          case "task-failed":
            if (event.taskId) {
              this.taskStates[event.taskId] = "failed";
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
      return res.success;
    } catch (e) {
      console.error("EditorStore: Compile failed:", e);
      this.isCompiling = false;
      return false;
    }
  }

  /** runAllPaths runs every path in the file sequentially. */
  async runAllPaths() {
    if (!this.selectedFilePath || this.isRunning) return;
    const paths = this.allPaths;
    for (let i = 0; i < paths.length; i++) {
      await this.runPath(i);
    }
  }

  /** runPath runs a single path by its index. */
  async runPath(pathIndex: number) {
    if (!this.selectedFilePath || this.isRunning) return;
    this.isRunning = true;
    this.taskStates = {};

    try {
      const res = await ProvarAPI.runTestPath(
        this.selectedFilePath,
        pathIndex,
        undefined,
        true,
      );
      if (!res.success) {
        this.isRunning = false;
        alert(`Test execution failed to start: ${res.error}`);
      }
    } catch (e) {
      console.error("EditorStore: Run failed:", e);
      this.isRunning = false;
    }
  }

  /** runPathUpTo runs a path stopping execution at the given task node. */
  async runPathUpTo(pathIndex: number, upToTaskId: string) {
    if (!this.selectedFilePath || this.isRunning) return;
    this.isRunning = true;
    this.taskStates = {};

    try {
      const res = await ProvarAPI.runTestPath(
        this.selectedFilePath,
        pathIndex,
        upToTaskId,
        true,
      );
      if (!res.success) {
        this.isRunning = false;
        alert(`Test execution failed to start: ${res.error}`);
      }
    } catch (e) {
      console.error("EditorStore: Run failed:", e);
      this.isRunning = false;
    }
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
    this.taskStates = {};
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
        this.currentFile = deleteNodeFromGraph(
          $state.snapshot(file),
          id,
        );
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
