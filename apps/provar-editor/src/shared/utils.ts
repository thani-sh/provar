import type { TestNode } from './domain';

/**
 * Normalises the `next` field of a test node into a consistent array form.
 */
export function getNextNodes(node: Pick<TestNode, 'next'>): string[] {
	if (!node.next) return [];
	return Array.isArray(node.next) ? node.next : [node.next];
}

export type CodeStatus = 'upToDate' | 'outdated' | 'notGenerated';

/**
 * Derives the code-generation status of a node.
 */
export function getCodeStatus(
	node: Pick<TestNode, 'hasGeneratedCode' | 'isUpToDate'>
): CodeStatus {
	if (!node.hasGeneratedCode) return 'notGenerated';
	if (!node.isUpToDate) return 'outdated';
	return 'upToDate';
}
