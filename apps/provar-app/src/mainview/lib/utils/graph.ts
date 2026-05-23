import type { TestFile, TestNode } from "../../../shared/domain";
import { generateNodeId } from "../../../shared/utils";

export function addNodeToGraph(
  file: TestFile,
  fromId: string | null,
  toId: string | null,
): { file: TestFile; newNodeId: string } {
  const newFile = structuredClone(file);
  const newNodeId = generateNodeId();
  const newNode: TestNode = {
    title: "New Action",
    info: "Describe what this action does...",
    next: toId || undefined,
  };

  newFile.graph.nodes[newNodeId] = newNode;

  if (fromId === null) {
    newFile.graph.start = newNodeId;
  } else {
    const parentNode = newFile.graph.nodes[fromId];
    if (parentNode) {
      if (!parentNode.next) {
        parentNode.next = newNodeId;
      } else if (Array.isArray(parentNode.next)) {
        if (toId) {
          parentNode.next = parentNode.next.map((id) =>
            id === toId ? newNodeId : id,
          );
        } else {
          parentNode.next.push(newNodeId);
        }
      } else {
        parentNode.next = newNodeId;
      }
    }
  }

  return { file: newFile, newNodeId };
}

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

export function deleteNodeFromGraph(file: TestFile, id: string): TestFile {
  const newFile = structuredClone(file);
  const idsToDelete = new Set<string>();

  function collectIds(nodeId: string) {
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

  Object.values(newFile.graph.nodes).forEach((node) => {
    if (Array.isArray(node.next)) {
      node.next = (node.next as string[]).filter(
        (nextId) => !idsToDelete.has(nextId),
      );
      if ((node.next as string[]).length === 0) delete node.next;
    } else if (node.next && idsToDelete.has(node.next as string)) {
      delete node.next;
    }
  });

  return newFile;
}
