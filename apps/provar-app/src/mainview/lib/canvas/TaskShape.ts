import * as PIXI from "pixi.js";
import { NodeShape } from "./NodeShape";
import { COLOURS, LAYOUT, type TaskState } from "./constants";
import { getCodeStatus } from "../../../shared/utils";
import type { TestNode } from "@libs/domain/zod";

/** TaskShape renders a graph node for a single test task. */
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
    onClick: (id: string) => void,
  ) {
    super(nodeId, node.title, node.info, state);

    this.eventMode = "static";
    this.cursor = "pointer";

    this.hitArea = new PIXI.Rectangle(0, 0, this.bg.width, this.bg.height);

    this.on("pointerdown", (e) => {
      e.stopPropagation();
      onClick(nodeId);
    });

    const icons: PIXI.Graphics[] = [];

    const addIcon = (draw: (g: PIXI.Graphics) => void, alpha: number = 0.5) => {
      const g = new PIXI.Graphics();
      draw(g);
      g.alpha = alpha;
      icons.push(g);
      this.iconRow.addChild(g);
    };

    // Execution state icon (success / failed / running)
    if (state === "success") {
      addIcon((g) => {
        g.moveTo(2, 5);
        g.lineTo(5, 8);
        g.lineTo(9, 2);
        g.stroke({
          color: 0x10b981,
          width: 2,
          join: "round",
          cap: "round",
        });
      }, 1.0);
    } else if (state === "failed") {
      addIcon((g) => {
        g.moveTo(2, 2);
        g.lineTo(8, 8);
        g.moveTo(8, 2);
        g.lineTo(2, 8);
        g.stroke({
          color: 0xef4444,
          width: 2,
          join: "round",
          cap: "round",
        });
      }, 1.0);
    } else if (state === "running") {
      addIcon((g) => {
        g.circle(5, 5, 4);
        g.stroke({
          color: 0x3b82f6,
          width: 1.5,
        });
      }, 1.0);
    }

    // Sub-graph icon
    if (node.graph) {
      addIcon((g) => {
        g.rect(1, 1, 3, 3);
        g.rect(6, 6, 3, 3);
        g.moveTo(4, 4);
        g.lineTo(6, 6);
        g.stroke({
          color: COLOURS.iconNeutral,
          width: 1.5,
          join: "round",
          cap: "round",
        });
      });
    }

    // Code status icon
    const codeStatus = getCodeStatus(node);
    const codeColor =
      codeStatus === "upToDate" ? COLOURS.codeUpToDate : COLOURS.codeOutdated;
    const codeAlpha = codeStatus === "upToDate" ? 0.8 : 1.0;

    addIcon((g) => {
      g.moveTo(3, 1);
      g.lineTo(0, 5);
      g.lineTo(3, 9);
      g.moveTo(7, 1);
      g.lineTo(10, 5);
      g.lineTo(7, 9);
      g.moveTo(6, 0);
      g.lineTo(4, 10);
      g.stroke({ color: codeColor, width: 1.5, join: "round", cap: "round" });
    }, codeAlpha);

    // Layout icons horizontally inside the icon row
    let offsetX = 0;
    for (const icon of icons) {
      icon.x = offsetX;
      offsetX += LAYOUT.iconSize + LAYOUT.iconSpacing;
    }
  }
}
