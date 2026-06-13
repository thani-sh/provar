import * as PIXI from "pixi.js";
import type { TestFile, TestFileGraph as Graph } from "@libs/domain/zod";
import { TaskShape } from "./task-shape";
import { StartShape } from "./start-shape";
import { EndShape } from "./end-shape";
import { ConnectorShape } from "./connector-shape";
import { GRAPH_START_ID, LAYOUT, CONNECTOR, type TaskState } from "./constants";
import { getNextNodes } from "../../../shared/utils";

/**
 * Canonical lifecycle states used for connector and Start/End rendering.
 * The store's TaskState union also includes "mixed" and "compiled" as
 * node-only aggregates, but those don't make sense for an edge — a single
 * connector can't be "mixed across paths" and "compiled" is the compile-pass
 * indicator. We collapse them onto the canonical five here so the connector
 * rule can stay one line.
 */
type ConnectorState = "idle" | "compiling" | "running" | "success" | "failed";

function normalizeState(state: TaskState): ConnectorState {
  switch (state) {
    case "compiling":
    case "running":
    case "failed":
    case "idle":
      return state;
    case "success":
    case "compiled":
      // "compiled" is a successful compile pass — same visual semantics as success.
      return "success";
    case "mixed":
      // "mixed" means some paths failed → treat as a failure for edge/Start/End.
      return "failed";
  }
}

/**
 * resolveNodeState returns the effective ConnectorState for any node id —
 * real, virtual Start, or virtual End. Centralising the rules here keeps
 * the connector logic a one-liner and guarantees Start, End, and the
 * connector leading to/from them all agree.
 *
 *   Start:   "success" iff the first real node is non-idle, else "idle".
 *   End:     "success" iff the preceding real node is "success", else "idle".
 *   Real:    the normalized state of taskStates[id] (or "idle" if missing).
 */
function resolveNodeState(
  id: string,
  graph: Graph,
  taskStates: Record<string, TaskState>,
): ConnectorState {
  if (id === GRAPH_START_ID) {
    if (!graph.start) return "idle";
    const firstState = taskStates[graph.start] ?? "idle";
    return firstState === "idle" ? "idle" : "success";
  }
  if (id.startsWith("end_")) {
    const taskId = id.substring(4);
    return taskStates[taskId] === "success" ? "success" : "idle";
  }
  return normalizeState(taskStates[id] ?? "idle");
}

/**
 * computeConnectorState returns the visual state of the connector between
 * two node ids. The rule is the strict one-liner:
 *
 *   connector = SA == SB ? SA : SB
 *
 * where SA / SB are the ConnectorState of the source and target node
 * (resolved via resolveNodeState so virtual Start / End are handled
 * consistently). On a mismatch the target's state wins, which reads as
 * "the wave has reached B" since the connector's purpose is to show
 * what is happening between A and B.
 */
function computeConnectorState(
  from: string,
  to: string,
  graph: Graph,
  taskStates: Record<string, TaskState>,
): ConnectorState {
  const sa = resolveNodeState(from, graph, taskStates);
  const sb = resolveNodeState(to, graph, taskStates);
  return sa === sb ? sa : sb;
}

/**
 * GraphRenderer compiles the test task definitions into visual PIXI containers and aligns positions.
 */
export class GraphRenderer extends PIXI.Container {
  private readonly taskShapes = new Map<string, TaskShape>();
  private readonly endShapes = new Map<string, EndShape>();
  private readonly connectorShapes = new Map<string, ConnectorShape>();
  private readonly linksContainer = new PIXI.Container();
  private startShape!: StartShape;
  private graph: Graph | null = null;
  private readonly onNodeSelect: (id: string) => void;
  private readonly onAddNode: (
    fromId: string | null,
    toId: string | null,
  ) => void;

  constructor(
    testFile: TestFile,
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
    ticker: PIXI.Ticker,
    onNodeSelect: (id: string) => void,
    onAddNode: (fromId: string | null, toId: string | null) => void,
  ) {
    super();
    this.onNodeSelect = onNodeSelect;
    this.onAddNode = onAddNode;
    this.addChild(this.linksContainer);
    this.graph = testFile.graph;
    this.build(testFile.graph, taskStates, runningPathNodeIds, {}, ticker);
  }

  private build(
    graph: Graph,
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    >,
    ticker: PIXI.Ticker,
  ) {
    this.createShapes(
      graph,
      taskStates,
      runningPathNodeIds,
      compilationStates,
      ticker,
    );
    const depths = this.computeDepths(graph);
    this.assignPositions(graph, depths);
    this.drawConnections(graph, taskStates);
  }

  /**
   * setState updates the visual state of every existing shape in-place
   * without destroying or recreating PIXI objects. This is the key to
   * avoiding WebGL context loss during long test runs — full graph rebuilds
   * destroy and recreate dozens of Graphics/Text/Container per task event,
   * which stresses the WebGL context and can cause it to be lost.
   *
   * Re-issuing stroke/fill on an existing PIXI.Graphics is cheap: the
   * underlying GPU buffers are reused, so we avoid the churn that triggers
   * context loss.
   */
  public setState(
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    > = {},
  ): void {
    if (!this.graph) return;

    // Update node borders
    const startOnPath = runningPathNodeIds.size > 0;
    const startState = resolveNodeState(GRAPH_START_ID, this.graph, taskStates);
    this.startShape.setState(startState, startOnPath, true);

    for (const [id, shape] of this.taskShapes) {
      const state = taskStates[id] ?? "idle";
      const onActivePath = runningPathNodeIds.has(id);
      // A task is considered "compiled" once it has reached a definitive
      // outcome: success, failure, or in-flight compilation. We deliberately
      // exclude "idle" so un-compiled / never-attempted tasks render at 80%.
      const compileResult = compilationStates[id];
      const isCompiled =
        compileResult === "compiled" ||
        compileResult === "failed" ||
        compileResult === "compiling";
      shape.setState(state, onActivePath, isCompiled);
    }

    for (const [id, shape] of this.endShapes) {
      // end_<taskId> — preceding task state determines End visual
      const taskId = id.startsWith("end_") ? id.substring(4) : "";
      const endState = resolveNodeState(id, this.graph, taskStates);
      // End is "on path" only if its preceding task is on the active path
      const onActivePath = runningPathNodeIds.has(taskId);
      shape.setState(endState, onActivePath, true);
    }

    // Update connector colors via the strict SA==SB ? SA : SB rule.
    for (const [key, connector] of this.connectorShapes) {
      const [from, to] = key.split("|");
      if (!from || !to) continue;
      const state = computeConnectorState(from, to, this.graph, taskStates);
      connector.setState(state);
    }
  }

  private createShapes(
    graph: Graph,
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    >,
    ticker: PIXI.Ticker,
  ) {
    // Start node is always on the active path when any run is happening
    const startOnPath = runningPathNodeIds.size > 0;
    const startState = resolveNodeState(GRAPH_START_ID, graph, taskStates);
    this.startShape = new StartShape(startState, startOnPath);
    this.addChild(this.startShape);

    for (const [id, node] of Object.entries(graph.nodes)) {
      const state = taskStates[id] || "idle";
      const onActivePath = runningPathNodeIds.has(id);
      // See setState above: "compiled" / "failed" / "compiling" all count as
      // a node that the user has seen in action. Only "idle" / missing means
      // the node has never been compiled and should render at 80% alpha.
      const compileResult = compilationStates[id];
      const isCompiled =
        compileResult === "compiled" ||
        compileResult === "failed" ||
        compileResult === "compiling";
      const shape = new TaskShape(
        id,
        node,
        state,
        onActivePath,
        ticker,
        this.onNodeSelect,
        isCompiled,
      );
      this.taskShapes.set(id, shape);
      this.addChild(shape);

      if (getNextNodes(node).length === 0) {
        const endId = `end_${id}`;
        // End is "success" iff the preceding task is "success", else "idle".
        const endState = resolveNodeState(endId, graph, taskStates);
        const endOnPath = onActivePath;
        const endShape = new EndShape(endState, endOnPath);
        this.endShapes.set(endId, endShape);
        this.addChild(endShape);
      }
    }

    if (!graph.start || !graph.nodes[graph.start]) {
      const endId = `end_${GRAPH_START_ID}`;
      const endShape = new EndShape("idle", startOnPath);
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
          const shape = this.taskShapes.get(id) || this.endShapes.get(id);
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
            const shape = this.taskShapes.get(id) || this.endShapes.get(id);
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
          const shape = this.taskShapes.get(id) || this.endShapes.get(id);
          if (shape) {
            shape.x = layerX.get(d) ?? 0;
            shape.y = centerY;
          }
        }
        currentY += height + LAYOUT.verticalSpacing;
      }
    }
  }

  private drawConnections(graph: Graph, taskStates: Record<string, TaskState>) {
    this.linksContainer.removeChildren();
    this.connectorShapes.clear();

    const firstShape = this.taskShapes.get(graph.start);
    if (firstShape) {
      const startTo = graph.start;
      const c = new ConnectorShape(
        this.startShape.x + this.startShape.width + CONNECTOR.startGap,
        this.startShape.y,
        firstShape.x - CONNECTOR.endGap,
        firstShape.y,
        () => this.onAddNode(null, startTo),
        "horizontal",
        // Use the same strict rule as setState so the initial paint is
        // consistent with the in-place updates that follow.
        computeConnectorState(GRAPH_START_ID, startTo, graph, taskStates),
      );
      this.connectorShapes.set(this.edgeKey(GRAPH_START_ID, startTo), c);
      this.linksContainer.addChild(c);
    } else {
      const startEndShape = this.endShapes.get(`end_${GRAPH_START_ID}`);
      if (startEndShape) {
        const toId = `end_${GRAPH_START_ID}`;
        const c = new ConnectorShape(
          this.startShape.x + this.startShape.width + CONNECTOR.startGap,
          this.startShape.y,
          startEndShape.x - CONNECTOR.endGap,
          startEndShape.y,
          () => this.onAddNode(null, null),
          "horizontal",
          computeConnectorState(GRAPH_START_ID, toId, graph, taskStates),
        );
        this.connectorShapes.set(this.edgeKey(GRAPH_START_ID, toId), c);
        this.linksContainer.addChild(c);
      }
    }

    for (const [id, node] of Object.entries(graph.nodes)) {
      const shape = this.taskShapes.get(id);
      if (!shape) continue;

      const nextNodes = getNextNodes(node);
      if (nextNodes.length === 0) {
        const target = this.endShapes.get(`end_${id}`);
        if (target) {
          const toId = `end_${id}`;
          const c = new ConnectorShape(
            shape.x + shape.width + CONNECTOR.startGap,
            shape.y,
            target.x - CONNECTOR.endGap,
            target.y,
            () => this.onAddNode(id, null),
            "horizontal",
            computeConnectorState(id, toId, graph, taskStates),
          );
          this.connectorShapes.set(this.edgeKey(id, toId), c);
          this.linksContainer.addChild(c);
        }
      } else {
        for (const nextId of nextNodes) {
          const target = this.taskShapes.get(nextId);
          if (!target) continue;

          const c = new ConnectorShape(
            shape.x + shape.width + CONNECTOR.startGap,
            shape.y,
            target.x - CONNECTOR.endGap,
            target.y,
            () => this.onAddNode(id, nextId),
            "horizontal",
            computeConnectorState(id, nextId, graph, taskStates),
          );
          this.connectorShapes.set(this.edgeKey(id, nextId), c);
          this.linksContainer.addChild(c);
        }
      }
    }
  }

  private edgeKey(from: string, to: string): string {
    return `${from}|${to}`;
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
