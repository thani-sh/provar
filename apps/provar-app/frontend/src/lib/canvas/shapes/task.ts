import type { Ticker } from 'pixi.js';
import { NodeShape } from './shape';
import { type TaskState } from '../constants';
import type { TestNode } from '../../types';
import { buildIconRow } from '../icons';

export class TaskShape extends NodeShape {
  protected override get cornerRadius() {
    return 8;
  }
  protected override get paddingX() {
    return 14;
  }
  protected override get paddingY() {
    return 11;
  }

  constructor(
    nodeId: string,
    node: TestNode,
    state: TaskState,
    onActivePath: boolean,
    ticker: Ticker,
    onClick: (id: string) => void,
    isCompiled: boolean = false,
  ) {
    super(nodeId, node.title, node.info ?? '', state, onActivePath, isCompiled);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.hitArea = { x: 0, y: 0, width: this.bg.width, height: this.bg.height } as never;

    this.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick(nodeId);
    });

    const { container, tick } = buildIconRow(state, node, ticker);
    this.iconRow.addChild(container);

    if (tick) {
      this.on('destroyed', () => ticker.remove(tick));
    }
  }
}