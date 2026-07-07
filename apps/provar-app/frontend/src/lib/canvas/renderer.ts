import { Container, type Ticker } from 'pixi.js';
import type { TestFile } from '../types';
import { StartShape } from './shapes/start';
import { EndShape } from './shapes/end';
import { TaskShape } from './shapes/task';
import { ConnectorShape } from './shapes/connector';
import { type TaskState } from './constants';
import { computeConnectorState } from './state';
import {
  assignPositions,
  collectEdges,
  computeDepths,
  type Edge,
  type PositionedNode,
} from './layout';

/**
 * GraphRenderer owns the per-graph scene graph. It builds node + edge
 * shapes from a TestFile and exposes setState for in-place state
 * updates without rebuilding the whole scene.
 */
export class GraphRenderer extends Container {
  private readonly taskShapes = new Map<string, TaskShape>();
  private readonly endShapes = new Map<string, EndShape>();
  private readonly connectorShapes = new Map<string, ConnectorShape>();
  private startShape: StartShape | null = null;
  private positions = new Map<string, { x: number; y: number }>();

  constructor(
    testFile: TestFile,
    taskStates: Record<string, TaskState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    private readonly ticker: Ticker,
    private readonly onNodeSelect: (id: string | null) => void,
    private readonly onAddNode: (fromId: string | null, toId: string | null) => void,
    private readonly compilationStates: Record<string, 'compiling' | 'compiled' | 'failed' | 'idle'> = {},
  ) {
    super();
    this.build(testFile, taskStates, runningPathNodeIds);
  }

  private build(
    testFile: TestFile,
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
  ) {
    const { graph } = testFile;
    const depths = computeDepths(graph);
    const positions = assignPositions(graph, depths);
    this.positions = new Map(positions.map((p) => [p.id, p]));

    // Start node
    const startPos = this.positions.get(graph.start) ?? { x: 0, y: 0 };
    this.startShape = new StartShape('idle', false);
    this.startShape.position.set(startPos.x - 60, startPos.y);
    this.addChild(this.startShape);

    // Task nodes
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (id === graph.start || id.startsWith('end_')) continue;
      const pos = this.positions.get(id)!;
      const state = taskStates[id] ?? 'idle';
      const isCompiled = this.compilationStates[id] === 'compiled';
      const shape = new TaskShape(
        id,
        node as never,
        state,
        runningPathNodeIds.has(id),
        this.ticker,
        (selectedId) => this.onNodeSelect(selectedId),
        isCompiled,
      );
      shape.position.set(pos.x, pos.y);
      this.taskShapes.set(id, shape);
      this.addChild(shape);
    }

    // End nodes
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (!id.startsWith('end_')) continue;
      const pos = this.positions.get(id)!;
      const state = taskStates[id] ?? 'idle';
      const shape = new EndShape(state, runningPathNodeIds.has(id));
      shape.position.set(pos.x + 60, pos.y);
      this.endShapes.set(id, shape);
      this.addChild(shape);
    }

    // Connectors
    for (const edge of collectEdges(graph)) {
      this.addEdge(edge, taskStates);
    }
  }

  private addEdge(edge: Edge, taskStates: Record<string, TaskState>) {
    const from = this.positions.get(edge.from);
    const to = this.positions.get(edge.to);
    if (!from || !to) return;
    const state = computeConnectorState(edge.from, edge.to, taskStates);
    const isStart = edge.from === '__start__';
    const startX = isStart ? from.x - 60 + 30 : from.x + 90; // approx right edge
    const startY = from.y;
    const endX = to.x - 90; // approx left edge of target
    const endY = to.y;
    const shape = new ConnectorShape(startX, startY, endX, endY, 'horizontal', state);
    this.addChild(shape);
    this.connectorShapes.set(`${edge.from}→${edge.to}`, shape);
  }

  public setState(
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
    compilationStates: Record<string, 'compiling' | 'compiled' | 'failed' | 'idle'> = {},
  ) {
    for (const [id, shape] of this.taskShapes) {
      const compiled = compilationStates[id] === 'compiled';
      shape.setState(
        taskStates[id] ?? 'idle',
        runningPathNodeIds.has(id),
        compiled,
      );
    }
    for (const [id, shape] of this.endShapes) {
      shape.setState(taskStates[id] ?? 'idle', runningPathNodeIds.has(id));
    }
    for (const [key, shape] of this.connectorShapes) {
      const [from, to] = key.split('→');
      shape.setState(computeConnectorState(from, to, taskStates));
    }
  }
}