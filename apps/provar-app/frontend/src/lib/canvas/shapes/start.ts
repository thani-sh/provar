import { NodeShape } from './shape';
import { GRAPH_START_ID, type ActionState } from '../constants';

export class StartShape extends NodeShape {
  protected override get cornerRadius() {
    return -1;
  }
  protected override get minWidth() {
    return 0;
  }
  protected override get paddingX() {
    return 20;
  }
  protected override get paddingY() {
    return 10;
  }

  constructor(state: ActionState = 'idle', onActivePath: boolean = false) {
    super(GRAPH_START_ID, 'Start', '', state, onActivePath, true);
    this.eventMode = 'none';
    this.iconRow.visible = false;
  }
}