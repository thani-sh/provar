import { Container, type Ticker } from 'pixi.js';
import type { TestFileView } from '../types';
import { StartShape } from './shapes/start';
import { EndShape } from './shapes/end';
import { ActionShape } from './shapes/action';
import { ConnectorShape } from './shapes/connector';
import { type ActionState } from './constants';
import { computeConnectorState } from './state';
import {
  assignPositions,
  collectEdges,
  computeDepths,
  type PositionedNode,
} from './layout';
import type { Edge } from '../types';

/**
 * GraphRenderer owns the per-graph scene graph. It builds node + edge
 * shapes from a TestFileView and exposes setState for in-place state
 * updates without rebuilding the whole scene.
 */
export class GraphRenderer extends Container {
  private readonly actionShapes = new Map<string, ActionShape>();
  private readonly endShapes = new Map<string, EndShape>();
  private readonly connectorShapes = new Map<string, ConnectorShape>();
  private startShape: StartShape | null = null;
  private positions = new Map<string, { x: number; y: number }>();

  constructor(
    file: TestFileView,
    actionStates: Record<string, ActionState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    private readonly ticker: Ticker,
    private readonly onNodeSelect: (id: string | null) => void,
    private readonly onAddNode: (fromId: string | null, toId: string | null) => void,
    private readonly compilationStates: Record<string, 'compiling' | 'compiled' | 'failed' | 'idle'> = {},
  ) {
    super();
    this.build(file, actionStates, runningPathNodeIds);
  }

  private build(
    file: TestFileView,
    actionStates: Record<string, ActionState>,
    runningPathNodeIds: Set<string>,
  ) {
    const { graph } = file;
    const depths = computeDepths(graph);
    const positions = assignPositions(graph, depths);
    this.positions = new Map(positions.map((p) => [p.id, p]));

    // Start node
    const startPos = this.positions.get(graph.start) ?? { x: 0, y: 0 };
    this.startShape = new StartShape('idle', false);
    this.startShape.position.set(startPos.x - 60, startPos.y);
    this.addChild(this.startShape);

    // Action nodes
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (id === graph.start || id.startsWith('end_')) continue;
      const pos = this.positions.get(id)!;
      const state = actionStates[id] ?? 'idle';
      const isCompiled = this.compilationStates[id] === 'compiled';
      const shape = new ActionShape(
        id,
        node,
        state,
        runningPathNodeIds.has(id),
        this.ticker,
        (selectedId) => this.onNodeSelect(selectedId),
        isCompiled,
      );
      shape.position.set(pos.x, pos.y);
      this.actionShapes.set(id, shape);
      this.addChild(shape);
    }

    // End nodes
    for (const [id] of Object.entries(graph.nodes)) {
      if (!id.startsWith('end_')) continue;
      const pos = this.positions.get(id)!;
      const state = actionStates[id] ?? 'idle';
      const shape = new EndShape(state, runningPathNodeIds.has(id));
      shape.position.set(pos.x + 60, pos.y);
      this.endShapes.set(id, shape);
      this.addChild(shape);
    }

    // Connectors
    for (const edge of collectEdges(graph)) {
      this.addEdge(edge, actionStates);
    }
  }

  private addEdge(edge: Edge, actionStates: Record<string, ActionState>) {
    const from = this.positions.get(edge.from);
    const to = this.positions.get(edge.to);
    if (!from || !to) return;
    const state = computeConnectorState(edge.from, edge.to, actionStates);
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
    actionStates: Record<string, ActionState>,
    runningPathNodeIds: Set<string>,
    compilationStates: Record<string, 'compiling' | 'compiled' | 'failed' | 'idle'> = {},
  ) {
    for (const [id, shape] of this.actionShapes) {
      const compiled = compilationStates[id] === 'compiled';
      shape.setState(
        actionStates[id] ?? 'idle',
        runningPathNodeIds.has(id),
        compiled,
      );
    }
    for (const [id, shape] of this.endShapes) {
      shape.setState(actionStates[id] ?? 'idle', runningPathNodeIds.has(id));
    }
    for (const [key, shape] of this.connectorShapes) {
      const [from, to] = key.split('→');
      shape.setState(computeConnectorState(from, to, actionStates));
    }
  }
}