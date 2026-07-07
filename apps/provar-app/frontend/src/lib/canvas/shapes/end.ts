import { NodeShape } from './shape';
import { type ActionState } from '../constants';

export class EndShape extends NodeShape {
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
    super('end', 'End', '', state, onActivePath, true);
    this.iconRow.visible = false;
  }
}