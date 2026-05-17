import { readFile, access } from 'fs/promises';
import yaml from 'yaml';
import { CONFIG_FILE, configSchema } from '../../shared/domain';
import { getAbsPath } from '../utils';

export const getConfig = async () => {
	try {
		const configPath = getAbsPath(CONFIG_FILE);
		await access(configPath);
		const content = await readFile(configPath, 'utf-8');
		const parsed = yaml.parse(content);
		const config = configSchema.parse(parsed);
		return { config };
	} catch (e) {
		return { config: null };
	}
};
