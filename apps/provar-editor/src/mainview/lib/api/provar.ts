import { electroview } from './rpc';
import type { ProvarConfig, TestFile } from '../../../shared/domain';

export const ProvarAPI = {
	async getWorkspace() {
		return await electroview.rpc.request.getWorkspace({});
	},

	async getConfig() {
		return await electroview.rpc.request.getConfig({});
	},

	async saveConfig(config: ProvarConfig) {
		return await electroview.rpc.request.saveConfig({ config });
	},

	async listFiles() {
		return await electroview.rpc.request.listFiles({});
	},

	async readFile(path: string) {
		return await electroview.rpc.request.readFile({ path });
	},

	async writeFile(path: string, content: TestFile) {
		return await electroview.rpc.request.writeFile({ path, content });
	},

	async createFile(path: string, name: string) {
		return await electroview.rpc.request.createFile({ path, name });
	},

	async createDirectory(path: string) {
		return await electroview.rpc.request.createDirectory({ path });
	},

	async deletePath(path: string) {
		return await electroview.rpc.request.deletePath({ path });
	},

	async assistEditor(prompt: string, path?: string) {
		return await electroview.rpc.request.assistEditor({ prompt, path });
	}
};
