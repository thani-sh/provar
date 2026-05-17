import { readdir } from 'fs/promises';
import { join } from 'path';
import { TESTS_DIR } from '../../shared/domain';
import { getAbsPath } from '../utils';

export const listFiles = async () => {
	const tests: string[] = [];

	const scan = async (dir: string, extension: string, results: string[]) => {
		try {
			const entries = await readdir(getAbsPath(dir), { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					await scan(fullPath, extension, results);
				} else if (entry.name.endsWith(extension)) {
					results.push(fullPath);
				}
			}
		} catch (e) {
			console.warn(`Could not read directory ${dir}`, e);
		}
	};

	await scan(TESTS_DIR, '.test.yml', tests);

	return { tests };
};
