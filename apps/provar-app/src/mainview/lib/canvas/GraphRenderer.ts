import * as PIXI from "pixi.js";
import type { TestFile, Graph } from "../../../shared/domain";
import { ActionShape } from "./ActionShape";
import { StartShape } from "./StartShape";
import { EndShape } from "./EndShape";
import { ConnectorShape } from "./ConnectorShape";
import { GRAPH_START_ID, LAYOUT, CONNECTOR } from "./constants";
import { getNextNodes } from "../../../shared/utils";

export class GraphRenderer extends PIXI.Container {
  private readonly actionShapes = new Map<string, ActionShape>();
  private readonly endShapes = new Map<string, EndShape>();
  private readonly linksContainer = new PIXI.Container();
  private readonly startShape: StartShape;
  private readonly onNodeSelect: (id: string) => void;
  private readonly onAddNode: (
    fromId: string | null,
    toId: string | null,
  ) => void;

  constructor(
    testFile: TestFile,
    taskStates: Record<string, "idle" | "running" | "success" | "failed">,
    onNodeSelect: (id: string) => void,
    onAddNode: (fromId: string | null, toId: string | null) => void,
  ) {
    super();
    this.onNodeSelect = onNodeSelect;
    this.onAddNode = onAddNode;
    this.addChild(this.linksContainer);
    this.startShape = new StartShape();
    this.addChild(this.startShape);
    this.build(testFile.graph, taskStates);
  }

  private build(
    graph: Graph,
    taskStates: Record<string, "idle" | "running" | "success" | "failed">,
  ) {
    this.createShapes(graph, taskStates);
    const depths = this.computeDepths(graph);
    this.assignPositions(graph, depths);
    this.drawConnections(graph, depths);
  }

  private createShapes(
    graph: Graph,
    taskStates: Record<string, "idle" | "running" | "success" | "failed">,
  ) {
    for (const [id, node] of Object.entries(graph.nodes)) {
      const state = taskStates[id] || "idle";
      const shape = new ActionShape(id, node, state, this.onNodeSelect);
      this.actionShapes.set(id, shape);
      this.addChild(shape);

      if (getNextNodes(node).length === 0) {
        const endId = `end_${id}`;
        const endShape = new EndShape();
        this.endShapes.set(endId, endShape);
        this.addChild(endShape);
      }
    }

    if (!graph.start || !graph.nodes[graph.start]) {
      const endId = `end_${GRAPH_START_ID}`;
      const endShape = new EndShape();
      this.endShapes.set(endId, endShape);
      this.addChild(endShape);
    }
  }

  private computeDepths(graph: Graph): Map<string, number> {
    const depths = new Map<string, number>();

    const visit = (id: string, currentDepth: number) => {
      const existing = depths.get(id);
      if (existing !== undefined && currentDepth <= existing) return;
      depths.set(id, currentDepth);

      const node = graph.nodes[id];
      if (node) {
        const nextNodes = getNextNodes(node);
        if (nextNodes.length === 0) {
          // Visit virtual end node
          visit(`end_${id}`, currentDepth + 1);
        } else {
          for (const nextId of nextNodes) {
            visit(nextId, currentDepth + 1);
          }
        }
      } else if (id === GRAPH_START_ID) {
        if (graph.start && graph.nodes[graph.start]) {
          visit(graph.start, 0);
        } else {
          visit(`end_${GRAPH_START_ID}`, 0);
        }
      }
    };

    visit(GRAPH_START_ID, -1);

    return depths;
  }

  private assignPositions(graph: Graph, depths: Map<string, number>) {
    const maxDepth = Math.max(0, ...depths.values());

    const layerWidths = new Map<number, number>();
    layerWidths.set(-1, this.startShape.width);

    for (let d = 0; d <= maxDepth; d++) {
      let maxW = 0;
      for (const [id, depth] of depths.entries()) {
        if (depth === d && id !== GRAPH_START_ID) {
          const shape = this.actionShapes.get(id) || this.endShapes.get(id);
          const w = shape?.nodeWidth ?? 0;
          if (w > maxW) maxW = w;
        }
      }
      layerWidths.set(d, maxW);
    }

    const layerX = new Map<number, number>();
    let currentX = 0;
    for (let d = -1; d <= maxDepth; d++) {
      layerX.set(d, currentX);
      layerX.set(d, currentX);
      const width =
        d === -1 ? this.startShape.nodeWidth : (layerWidths.get(d) ?? 0);
      currentX += width + LAYOUT.horizontalGap;
    }

    const edges = this.collectEdges(graph);

    for (let d = -1; d <= maxDepth; d++) {
      const items: { id: string; height: number }[] = [];

      if (d === -1) {
        items.push({ id: GRAPH_START_ID, height: this.startShape.nodeHeight });
      } else {
        for (const [id, depth] of depths.entries()) {
          if (depth === d && id !== GRAPH_START_ID) {
            const shape = this.actionShapes.get(id) || this.endShapes.get(id);
            if (shape) items.push({ id, height: shape.nodeHeight });
          }
        }
      }

      for (const { from, to } of edges) {
        const uDepth = depths.get(from) ?? -1;
        const vDepth = depths.get(to) ?? -1;
        if (uDepth < d && vDepth > d) {
          items.push({ id: `${from}->${to}`, height: 20 });
        }
      }

      const totalHeight =
        items.reduce((sum, item) => sum + item.height, 0) +
        Math.max(0, items.length - 1) * LAYOUT.verticalSpacing;

      let currentY = -totalHeight / 2;

      for (const { id, height } of items) {
        const centerY = currentY + height / 2;
        if (id === GRAPH_START_ID) {
          this.startShape.x = layerX.get(-1) ?? 0;
          this.startShape.y = centerY;
        } else {
          const shape = this.actionShapes.get(id) || this.endShapes.get(id);
          if (shape) {
            shape.x = layerX.get(d) ?? 0;
            shape.y = centerY;
          }
        }
        currentY += height + LAYOUT.verticalSpacing;
      }
    }
  }

  private drawConnections(graph: Graph, depths: Map<string, number>) {
    this.linksContainer.removeChildren();

    const firstShape = this.actionShapes.get(graph.start);
    if (firstShape) {
      this.linksContainer.addChild(
        new ConnectorShape(
          this.startShape.x + this.startShape.width + CONNECTOR.startGap,
          this.startShape.y,
          firstShape.x - CONNECTOR.endGap,
          firstShape.y,
          () => this.onAddNode(null, graph.start),
        ),
      );
    } else {
      const startEndShape = this.endShapes.get(`end_${GRAPH_START_ID}`);
      if (startEndShape) {
        this.linksContainer.addChild(
          new ConnectorShape(
            this.startShape.x + this.startShape.width + CONNECTOR.startGap,
            this.startShape.y,
            startEndShape.x - CONNECTOR.endGap,
            startEndShape.y,
            () => this.onAddNode(null, null),
          ),
        );
      }
    }

    for (const [id, node] of Object.entries(graph.nodes)) {
      const shape = this.actionShapes.get(id);
      if (!shape) continue;

      const nextNodes = getNextNodes(node);
      if (nextNodes.length === 0) {
        const target = this.endShapes.get(`end_${id}`);
        if (target) {
          this.linksContainer.addChild(
            new ConnectorShape(
              shape.x + shape.width + CONNECTOR.startGap,
              shape.y,
              target.x - CONNECTOR.endGap,
              target.y,
              () => this.onAddNode(id, null),
            ),
          );
        }
      } else {
        for (const nextId of nextNodes) {
          const target = this.actionShapes.get(nextId);
          if (!target) continue;

          this.linksContainer.addChild(
            new ConnectorShape(
              shape.x + shape.width + CONNECTOR.startGap,
              shape.y,
              target.x - CONNECTOR.endGap,
              target.y,
              () => this.onAddNode(id, nextId),
            ),
          );
        }
      }
    }
  }

  private collectEdges(graph: Graph): { from: string; to: string }[] {
    const edges: { from: string; to: string }[] = [];
    for (const [id, node] of Object.entries(graph.nodes)) {
      const nextNodes = getNextNodes(node);
      if (nextNodes.length === 0) {
        edges.push({ from: id, to: `end_${id}` });
      } else {
        for (const nextId of nextNodes) {
          edges.push({ from: id, to: nextId });
        }
      }
    }
    if (graph.start && graph.nodes[graph.start]) {
      edges.push({ from: GRAPH_START_ID, to: graph.start });
    } else {
      edges.push({ from: GRAPH_START_ID, to: `end_${GRAPH_START_ID}` });
    }
    return edges;
  }
}
