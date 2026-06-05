import type { TestNode, TestFileGraph } from "@libs/domain/zod";

/**
 * Normalises the `next` field of a test node into a consistent array form.
 */
export function getNextNodes(node: Pick<TestNode, "next">): string[] {
  if (!node.next) return [];
  return Array.isArray(node.next) ? node.next : [node.next];
}

/**
 * enumeratePaths returns every root-to-leaf execution path through the graph
 * as an ordered array of node IDs. Each entry in the returned array is one
 * distinct, linearly-executable path.
 */
export function enumeratePaths(graph: TestFileGraph): string[][] {
  const paths: string[][] = [];

  const walk = (id: string, current: string[]) => {
    const node = graph.nodes[id];
    if (!node) return;
    const next = getNextNodes(node);
    const path = [...current, id];
    if (next.length === 0) {
      paths.push(path);
    } else {
      for (const nextId of next) {
        walk(nextId, path);
      }
    }
  };

  if (graph.start && graph.nodes[graph.start]) {
    walk(graph.start, []);
  }

  return paths;
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
