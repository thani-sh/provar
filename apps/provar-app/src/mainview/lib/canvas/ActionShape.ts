import * as PIXI from "pixi.js";
import { NodeShape } from "./NodeShape";
import { COLOURS, LAYOUT } from "./constants";
import { getCodeStatus } from "../../../shared/utils";
import type { TestNode } from "../../../shared/domain";

export class ActionShape extends NodeShape {
  protected override get cornerRadius() {
    return -1;
  }
  protected override get paddingX() {
    return 24;
  }
  protected override get paddingY() {
    return 12;
  }

  constructor(nodeId: string, node: TestNode, onClick: (id: string) => void) {
    super(nodeId, node.title);

    this.eventMode = "static";
    this.cursor = "pointer";

    this.hitArea = new PIXI.Rectangle(0, 0, this.bg.width, this.bg.height);

    this.on("pointerdown", (e) => {
      e.stopPropagation();
      onClick(nodeId);
    });

    const iconContainer = new PIXI.Container();
    const icons: PIXI.Graphics[] = [];

    const addIcon = (draw: (g: PIXI.Graphics) => void, alpha: number = 0.5) => {
      const g = new PIXI.Graphics();
      draw(g);
      g.alpha = alpha;
      icons.push(g);
      iconContainer.addChild(g);
    };

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

    // node screenshotUrl is currently not in TestNode, but it was in the old EditorTestNode.
    // I'll skip pixel diff icon for now unless I add it to the schema.
    // if (node.visualPixelDiffEnabled) { ... }

    if (node.asserts && Object.keys(node.asserts).length > 0) {
      addIcon((g) => {
        g.moveTo(1, 5);
        g.lineTo(4, 8);
        g.lineTo(9, 2);
        g.stroke({
          color: COLOURS.assertGreen,
          width: 1.5,
          join: "round",
          cap: "round",
        });
      }, 0.8);
    }

    let offsetX = 0;
    for (const icon of icons) {
      icon.x = offsetX;
      offsetX += LAYOUT.iconSize + LAYOUT.iconSpacing;
    }
    const totalIconWidth = offsetX > 0 ? offsetX - LAYOUT.iconSpacing : 0;
    iconContainer.x = (this.bg.width - totalIconWidth) / 2;
    iconContainer.y = LAYOUT.iconAboveOffset;

    this.addChild(iconContainer);
  }
}
