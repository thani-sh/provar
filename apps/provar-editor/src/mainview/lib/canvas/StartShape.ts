import * as PIXI from "pixi.js";
import { NodeShape } from "./NodeShape";
import { GRAPH_START_ID } from "./constants";

export class StartShape extends NodeShape {
  constructor() {
    super(GRAPH_START_ID, "Start");

    this.eventMode = "none";
  }
}
