import { Container, type Ticker } from 'pixi.js';
import type { TestFileView } from '../types';
import { NodeShape } from './shapes/shape';
import { StartShape } from './shapes/start';
import { EndShape } from './shapes/end';
import { ActionShape } from './shapes/action';
import { ConnectorShape } from './shapes/connector';
import { type ActionState, LAYOUT } from './constants';
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

    // Start node — placed so its right edge sits a normal
    // inter-action gap to the left of the first action, so the gap
    // from Start to action 1 visually matches the gap between any two
    // actions. The inter-action gap is roughly `horizontalGap −
    // avgActionWidth`. We approximate that with an explicit
    // constant; if action widths drift, retune here.
    const startPos = this.positions.get(graph.start) ?? { x: 0, y: 0 };
    this.startShape = new StartShape('idle', false);
    const INTER_NODE_GAP = 52;
    const FIRST_ACTION_LEFT_EDGE = LAYOUT.horizontalGap; // depth 1 → x = horizontalGap
    this.startShape.position.set(
      FIRST_ACTION_LEFT_EDGE - INTER_NODE_GAP - this.startShape.nodeWidth,
      startPos.y,
    );
    this.addChild(this.startShape);

    // Action nodes — positions are depth × horizontalGap from
    // assignPositions, so each action's left edge is already a
    // horizontalGap past the previous action's left edge. With
    // typical action widths (~208), this leaves an
    // `INTER_NODE_GAP`-sized space between them.
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

    // End nodes — same convention as actions (left edge at depth ×
    // horizontalGap). The previous offset by `nodeWidth / 2 + pad`
    // shifted the End off by half-width, which is why the End used
    // to look detached from the chain.
    for (const [id] of Object.entries(graph.nodes)) {
      if (!id.startsWith('end_')) continue;
      const pos = this.positions.get(id)!;
      const state = actionStates[id] ?? 'idle';
      const shape = new EndShape(state, runningPathNodeIds.has(id));
      shape.position.set(pos.x, pos.y);
      this.endShapes.set(id, shape);
      this.addChild(shape);
    }

    // Connectors
    for (const edge of collectEdges(graph)) {
      this.addEdge(edge, actionStates);
    }
  }

  private shapeFor(id: string): NodeShape | null {
    if (this.startShape?.nodeId === id) return this.startShape;
    return this.actionShapes.get(id) ?? this.endShapes.get(id) ?? null;
  }

  private addEdge(edge: Edge, actionStates: Record<string, ActionState>) {
    const fromShape = this.shapeFor(edge.from);
    const toShape = this.shapeFor(edge.to);
    if (!fromShape || !toShape) return;
    const state = computeConnectorState(edge.from, edge.to, actionStates);
    // Connector endpoints are the right edge of the source and the
    // left edge of the target. Shape's pivot is at its left edge so
    // `position.x + nodeWidth` is the right edge and `position.x`
    // is the left edge. (Earlier versions used `nodeWidth / 2`,
    // which is each shape's centre — that's why connectors previously
    // started from inside source shapes and ended short of targets.)
    const startX = fromShape.position.x + fromShape.nodeWidth;
    const endX = toShape.position.x;
    const startY = fromShape.position.y;
    const endY = toShape.position.y;
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