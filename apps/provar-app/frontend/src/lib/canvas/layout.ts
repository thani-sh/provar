import { LAYOUT } from './constants';
import type { Edge, TestFileGraph } from '../types';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

/** collectEdges returns the flat list of {from,to} edges from the graph. */
export function collectEdges(graph: TestFileGraph): Edge[] {
  return graph.edges.map((e) => ({ from: e.from, to: e.to }));
}

/**
 * computeDepths assigns each node its column (depth) in the graph.
 * Depth is the longest path from the start node. Cycles fall back to
 * whichever column was assigned first.
 */
export function computeDepths(graph: TestFileGraph): Map<string, number> {
  const depths = new Map<string, number>();
  const inEdges = new Map<string, string[]>();
  for (const node of Object.keys(graph.nodes)) inEdges.set(node, []);
  for (const e of graph.edges) {
    const list = inEdges.get(e.to);
    if (list) list.push(e.from);
  }

  // BFS from start
  const queue: Array<[string, number]> = [[graph.start, 0]];
  depths.set(graph.start, 0);
  while (queue.length) {
    const [id, depth] = queue.shift()!;
    for (const e of graph.edges) {
      if (e.from !== id) continue;
      if (depths.has(e.to)) continue;
      depths.set(e.to, depth + 1);
      queue.push([e.to, depth + 1]);
    }
  }
  // Any node not reached (e.g. disconnected) lands at the rightmost column.
  let maxDepth = 0;
  for (const d of depths.values()) if (d > maxDepth) maxDepth = d;
  for (const id of Object.keys(graph.nodes)) {
    if (!depths.has(id)) depths.set(id, ++maxDepth);
  }
  return depths;
}

/**
 * assignPositions returns each node's (x, y) given the depths. y is
 * the per-column row index so multi-node columns don't overlap.
 */
export function assignPositions(
  graph: TestFileGraph,
  depths: Map<string, number>,
): PositionedNode[] {
  const perColumn = new Map<number, string[]>();
  for (const id of Object.keys(graph.nodes)) {
    const d = depths.get(id) ?? 0;
    const list = perColumn.get(d) ?? [];
    list.push(id);
    perColumn.set(d, list);
  }

  const out: PositionedNode[] = [];
  for (const [depth, ids] of perColumn) {
    ids.forEach((id, row) => {
      out.push({
        id,
        x: depth * LAYOUT.horizontalGap,
        y: (row - (ids.length - 1) / 2) * LAYOUT.verticalSpacing,
      });
    });
  }
  return out;
}