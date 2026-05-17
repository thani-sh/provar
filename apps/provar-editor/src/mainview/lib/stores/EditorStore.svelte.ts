import { ProvarAPI } from '../api/provar';
import { addNodeToGraph, updateNodeInGraph, deleteNodeFromGraph } from '../utils/graph';
import type { TestFile, TestNode } from '../../../shared/domain';
import { workspaceStore } from './WorkspaceStore.svelte';

class EditorStore {
	currentFile = $state<TestFile | null>(null);
	selectedFilePath = $state<string | null>(null);
	selectedNodeId = $state<string | null>(null);

	selectedNode = $derived.by(() => {
		if (!this.currentFile || !this.selectedNodeId) return null;
		return this.currentFile.graph.nodes[this.selectedNodeId] || null;
	});

	async loadFile(path: string) {
		this.selectedFilePath = path;
		const res = await ProvarAPI.readFile(path);
		this.currentFile = res.content;
		this.selectedNodeId = null;
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
		const { file, newNodeId } = addNodeToGraph(this.currentFile, fromId, toId);
		this.currentFile = file;
		this.selectedNodeId = newNodeId;
		await this.saveFile();
	}

	async updateNode(id: string, updates: Partial<TestNode>) {
		if (!this.currentFile) return;
		this.currentFile = updateNodeInGraph(this.currentFile, id, updates);
		await this.saveFile();
	}

	async deleteNode(id: string) {
		if (
			!this.currentFile ||
			!confirm('Are you sure you want to delete this node and all its descendants?')
		)
			return;

		this.currentFile = deleteNodeFromGraph(this.currentFile, id);
		this.selectedNodeId = null;
		await this.saveFile();
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
		const isFolder = !path.endsWith('.yml');
		const typeLabel = path.endsWith('.test.yml') ? 'test' : 'folder';

		if (confirm(`Are you sure you want to delete this ${typeLabel}?`)) {
			const res = await ProvarAPI.deletePath(path);
			if (res.success) {
				if (
					this.selectedFilePath === path ||
					(isFolder && this.selectedFilePath?.startsWith(path))
				) {
					this.closeFile();
				}
				await workspaceStore.refreshFiles();
			}
		}
	}
}

export const editorStore = new EditorStore();
