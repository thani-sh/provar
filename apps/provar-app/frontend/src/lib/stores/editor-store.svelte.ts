import type { TestFile, TestNode } from '../types';

/**
 * EditorStore holds the active test file and the currently selected node.
 * Compile and run state (compilation states, task states, running paths)
 * is added in a later phase when the debugger lands.
 */
class EditorStore {
  currentFile = $state<TestFile | null>(null);
  selectedFilePath = $state<string | null>(null);
  selectedNodeId = $state<string | null>(null);

  selectedNode = $derived.by(() => {
    if (!this.currentFile || !this.selectedNodeId) return null;
    return this.currentFile.graph.nodes[this.selectedNodeId] ?? null;
  });

  loadFile(path: string, file: TestFile) {
    this.selectedFilePath = path;
    this.currentFile = file;
    this.selectedNodeId = null;
  }

  closeFile() {
    this.selectedFilePath = null;
    this.currentFile = null;
    this.selectedNodeId = null;
  }

  updateNode(id: string, updates: Partial<TestNode>) {
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