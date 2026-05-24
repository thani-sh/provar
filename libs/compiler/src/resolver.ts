import type { TestGraph } from "@libs/domain";

// Function to resolve all unique linear paths from start to terminal nodes in a directed graph
export function resolvePaths(graphDef: TestGraph): string[][] {
  const paths: string[][] = [];
  const start = graphDef.graph.start;
  const nodes = graphDef.graph.nodes;

  if (!start || !nodes || !nodes[start]) {
    return [];
  }

  function traverse(
    currentNodeId: string,
    currentPath: string[],
    visited: Set<string>,
  ) {
    if (visited.has(currentNodeId)) {
      // Loop detected, truncate path to avoid infinite loops
      paths.push([...currentPath]);
      return;
    }

    const node = nodes[currentNodeId];
    if (!node) {
      paths.push([...currentPath]);
      return;
    }

    const nextPath = [...currentPath, currentNodeId];
    const newVisited = new Set(visited).add(currentNodeId);

    if (!node.next || (Array.isArray(node.next) && node.next.length === 0)) {
      paths.push(nextPath);
      return;
    }

    const nextNodes = Array.isArray(node.next) ? node.next : [node.next];
    for (const nextNode of nextNodes) {
      traverse(nextNode, nextPath, newVisited);
    }
  }

  traverse(start, [], new Set());
  return paths;
}
