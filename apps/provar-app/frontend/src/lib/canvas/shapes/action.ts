import { Rectangle, type Ticker } from 'pixi.js';
import { NodeShape } from './shape';
import { type ActionState } from '../constants';
import type { Action } from '../../types';
import { buildIconRow } from '../icons';

export class ActionShape extends NodeShape {
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
    actionId: string,
    action: Action,
    state: ActionState,
    onActivePath: boolean,
    ticker: Ticker,
    onClick: (id: string) => void,
    isCompiled: boolean = false,
  ) {
    super(actionId, action.title, action.info ?? '', state, onActivePath, isCompiled);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.hitArea = new Rectangle(0, 0, this.bg.width, this.bg.height);

    this.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick(actionId);
    });

    const { container, tick } = buildIconRow(state, action, ticker);
    this.iconRow.addChild(container);

    if (tick) {
      this.on('destroyed', () => ticker.remove(tick));
    }
  }
}