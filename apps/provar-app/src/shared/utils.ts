import type { TestNode } from "./domain";

/**
 * Normalises the `next` field of a test node into a consistent array form.
 */
export function getNextNodes(node: Pick<TestNode, "next">): string[] {
  if (!node.next) return [];
  return Array.isArray(node.next) ? node.next : [node.next];
}

/**
 * Generates a unique node ID in the format task_[a-z0-9]{5}.
 */
export function generateNodeId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `task_${result}`;
}

export type CodeStatus = "upToDate" | "outdated" | "notGenerated";

/**
 * Derives the code-generation status of a node.
 */
export function getCodeStatus(
  node: Pick<TestNode, "hasGeneratedCode" | "isUpToDate">,
): CodeStatus {
  if (!node.hasGeneratedCode) return "notGenerated";
  if (!node.isUpToDate) return "outdated";
  return "upToDate";
}
