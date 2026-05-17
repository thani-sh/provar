import { join } from 'path';
import { watch, type FSWatcher } from 'fs';

export let WORKSPACE_DIR = process.env.PROVAR_WORKSPACE_DIR || '';

let watcher: FSWatcher | null = null;
let watchCallback: (() => void) | null = null;

export const setWorkspaceDir = (path: string) => {
	WORKSPACE_DIR = path;
	startWatching();
};

export const getAbsPath = (path: string) => join(WORKSPACE_DIR, path);

export const onWorkspaceChanged = (callback: () => void) => {
	watchCallback = callback;
};

let debounceTimer: any = null;

const startWatching = () => {
	if (watcher) {
		watcher.close();
	}

	if (!WORKSPACE_DIR) return;

	try {
		watcher = watch(WORKSPACE_DIR, { recursive: true }, (event, filename) => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
			debounceTimer = setTimeout(() => {
				if (watchCallback) {
					watchCallback();
				}
			}, 100);
		});
	} catch (e) {
		console.error('Failed to start watching workspace:', e);
	}
};

export const triggerWorkspaceChanged = () => {
	if (watchCallback) {
		watchCallback();
	}
};
