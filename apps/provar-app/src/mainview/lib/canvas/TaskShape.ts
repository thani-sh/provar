import * as PIXI from "pixi.js";
import { NodeShape } from "./NodeShape";
import { COLOURS, LAYOUT, type TaskState } from "./constants";
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
    onActivePath: boolean,
    ticker: PIXI.Ticker,
    onClick: (id: string) => void,
  ) {
    super(nodeId, node.title, node.info, state, onActivePath);

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
      // Small spinning arc — same 10×10 icon box as all other icons
      const spinnerIcon = new PIXI.Graphics();
      spinnerIcon.alpha = 1.0;
      icons.push(spinnerIcon);
      this.iconRow.addChild(spinnerIcon);

      let angle = 0;
      const ARC_SPAN = Math.PI * 1.2;
      const cx = 5,
        cy = 5,
        r = 4;

      const tick = () => {
        angle += 0.08;
        spinnerIcon.clear();
        spinnerIcon.arc(cx, cy, r, angle, angle + ARC_SPAN);
        spinnerIcon.stroke({ color: 0x3b82f6, width: 1.5, cap: "round" });
      };

      ticker.add(tick);
      this.on("destroyed", () => ticker.remove(tick));
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

    // Pixel-diff icon — only shown when visual comparison is enabled on this node
    if (node.config?.visualCompare) {
      addIcon((g) => {
        // 3×3 grid of small squares representing a pixel/diff grid
        const cell = 2.5;
        const gap = 1;
        const cols = 3;
        const rows = 3;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            g.rect(col * (cell + gap), row * (cell + gap) + 0.5, cell, cell);
          }
        }
        g.fill({ color: COLOURS.assertGreen, alpha: 0.9 });
      }, 1.0);
    }

    // Layout icons horizontally inside the icon row
    let offsetX = 0;
    for (const icon of icons) {
      icon.x = offsetX;
      offsetX += LAYOUT.iconSize + LAYOUT.iconSpacing;
    }
  }
}
