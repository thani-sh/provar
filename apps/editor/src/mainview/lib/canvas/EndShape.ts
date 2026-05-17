import { NodeShape } from "./NodeShape";
import { COLOURS } from "./constants";

export class EndShape extends NodeShape {
  constructor() {
    super("end", "End");

    // Style it slightly differently if needed, e.g., different border or text color
    // For now, keeping it consistent with StartShape as per instructions.
  }
}
