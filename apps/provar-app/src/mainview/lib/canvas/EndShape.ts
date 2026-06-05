import { NodeShape } from "./NodeShape";
import { COLOURS } from "./constants";

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

  constructor(state: "idle" | "running" | "success" | "failed" = "idle") {
    super("end", "End", "", state);

    // Style it slightly differently if needed, e.g., different border or text color
    // For now, keeping it consistent with StartShape as per instructions.
    this.iconRow.visible = false;
  }
}
