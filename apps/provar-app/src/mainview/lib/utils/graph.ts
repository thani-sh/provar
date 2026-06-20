import type { TestFile, TestNode, TestFileGraph } from "@libs/domain/zod";
import type { Task } from "@libs/domain";
import { generateNodeId, getNextNodes } from "../../../shared/utils";

/**
 * toEngineTasks adapts the editor's `TestFileGraph.nodes` map into the engine's
 * `Record<string, Task>` shape so `buildGraphPaths` (from `@libs/engine`) can be
 * used directly. The two shapes only differ in:
 *
 *   - `Task` carries an explicit `id` field; in the editor the id is the key
 *     of the `nodes` record, so we copy the key into the field.
 *   - `Task.next` is always a `string[]`; the editor allows a single string or
 *     array, so we normalise through `getNextNodes`.
 *   - The editor's `TestNode` has display-only fields (`hasGeneratedCode`,
 *     `isUpToDate`, `screenshotUrl`) and an editor-flavoured nested `graph`.
 *     Neither matters for path enumeration; we drop them.
 *
 * Nested `graph` fields (sub-graphs inside a node) are intentionally NOT
 * converted — the editor only enumerates paths at the top level, and adding
 * recursive conversion here would silently diverge from `buildGraphPaths`'s
 * own single-level contract.
 */
export function toEngineTasks(graph: TestFileGraph): Record<string, Task> {
  const tasks: Record<string, Task> = {};
  for (const [id, node] of Object.entries(graph.nodes)) {
    tasks[id] = {
      id,
      title: node.title,
      info: node.info,
      next: getNextNodes(node),
    };
  }
  return tasks;
}

/**
 * addNodeToGraph creates a new task node and splices it into the test file graph.
 */
export function addNodeToGraph(
  file: TestFile,
  fromId: string | null,
  toId: string | null,
): { file: TestFile; newNodeId: string } {
  const newFile = structuredClone(file);
  const newNodeId = generateNodeId();
  const newNode: TestNode = {
    title: "New Task",
    info: "Describe what this task does...",
    next: toId || undefined,
  };

  newFile.graph.nodes[newNodeId] = newNode;

  if (fromId === null) {
    newFile.graph.start = newNodeId;
  } else {
    const parentNode = newFile.graph.nodes[fromId];
    if (parentNode) {
      const node: TestNode = parentNode;
      if (!node.next) {
        node.next = newNodeId;
      } else if (Array.isArray(node.next)) {
        const currentNexts = node.next;
        if (toId) {
          node.next = currentNexts.map((id) => (id === toId ? newNodeId : id));
        } else {
          node.next.push(newNodeId);
        }
      } else {
        node.next = newNodeId;
      }
    }
  }

  return { file: newFile, newNodeId };
}

/**
 * updateNodeInGraph updates the properties of a task node in the test file.
 */
export function updateNodeInGraph(
  file: TestFile,
  id: string,
  updates: Partial<TestNode>,
): TestFile {
  const newFile = structuredClone(file);
  if (newFile.graph.nodes[id]) {
    newFile.graph.nodes[id] = {
      ...newFile.graph.nodes[id],
      ...updates,
    };
  }
  return newFile;
}

/**
 * deleteNodeFromGraph deletes a task node and recursively deletes all downstream nodes.
 */
export function deleteNodeFromGraph(file: TestFile, id: string): TestFile {
  const newFile = structuredClone(file);
  const idsToDelete = new Set<string>();

  function collectIds(nodeId: string): void {
    if (idsToDelete.has(nodeId)) return;
    idsToDelete.add(nodeId);
    const node = newFile.graph.nodes[nodeId];
    if (node) {
      const nexts = Array.isArray(node.next)
        ? node.next
        : node.next
          ? [node.next]
          : [];
      nexts.forEach(collectIds);
    }
  }

  collectIds(id);

  idsToDelete.forEach((nodeId) => {
    delete newFile.graph.nodes[nodeId];
  });

  if (newFile.graph.start === id) {
    newFile.graph.start = "";
  }

  (Object.values(newFile.graph.nodes) as TestNode[]).forEach((node) => {
    if (Array.isArray(node.next)) {
      const currentNexts = node.next;
      node.next = currentNexts.filter((nextId) => !idsToDelete.has(nextId));
      if (node.next.length === 0) delete node.next;
    } else if (node.next && idsToDelete.has(node.next)) {
      delete node.next;
    }
  });

  return newFile;
}
