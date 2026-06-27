import * as PIXI from "pixi.js";
import { NodeShape } from "./node-shape";
import { GRAPH_START_ID, type TaskState } from "./constants";

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

  constructor(state: TaskState = "idle", onActivePath: boolean = false) {
    super(GRAPH_START_ID, "Start", "", state, onActivePath, true);

    this.eventMode = "none";
    this.iconRow.visible = false;
  }
}
