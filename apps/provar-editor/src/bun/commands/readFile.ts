import { readFile } from 'fs/promises';
import yaml from 'yaml';
import { testFileSchema } from '../../shared/domain';
import { getAbsPath } from '../utils';

export const readFileCommand = async ({ path }: { path: string }) => {
	const content = await readFile(getAbsPath(path), 'utf-8');
	const parsed = yaml.parse(content);
	const validated = testFileSchema.parse(parsed);
	return { content: validated };
};
