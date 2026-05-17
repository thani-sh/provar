import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import yaml from 'yaml';
import { getAbsPath, triggerWorkspaceChanged } from '../utils';

export const writeFileCommand = async ({ path, content }: { path: string; content: any }) => {
	const yamlContent = yaml.stringify(content);
	const fullPath = getAbsPath(path);
	await mkdir(dirname(fullPath), { recursive: true });
	await writeFile(fullPath, yamlContent, 'utf-8');
	triggerWorkspaceChanged();
	return { success: true };
};
