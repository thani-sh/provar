import type { Action, TestFileView } from '../types';

/**
 * EditorStore holds the active test file and the currently selected action.
 * Compile and run state (compilation states, action states, running paths)
 * is added in a later phase when the debugger lands.
 */
class EditorStore {
  currentFile = $state<TestFileView | null>(null);
  selectedFilePath = $state<string | null>(null);
  selectedNodeId = $state<string | null>(null);

  selectedNode = $derived.by(() => {
    if (!this.currentFile || !this.selectedNodeId) return null;
    return this.currentFile.graph.nodes[this.selectedNodeId] ?? null;
  });

  loadFile(path: string, file: TestFileView) {
    this.selectedFilePath = path;
    this.currentFile = file;
    this.selectedNodeId = null;
  }

  closeFile() {
    this.selectedFilePath = null;
    this.currentFile = null;
    this.selectedNodeId = null;
  }

  updateNode(id: string, updates: Partial<Action>) {
    if (!this.currentFile) return;
    const existing = this.currentFile.graph.nodes[id];
    if (!existing) return;
    this.currentFile = {
      ...this.currentFile,
      graph: {
        ...this.currentFile.graph,
        nodes: {
          ...this.currentFile.graph.nodes,
          [id]: { ...existing, ...updates },
        },
      },
    };
  }
}

export const editorStore = new EditorStore();