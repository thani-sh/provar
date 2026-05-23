import * as PIXI from "pixi.js";
import { COLOURS, TYPOGRAPHY } from "./constants";

export class NodeShape extends PIXI.Container {
  protected bg: PIXI.Graphics;
  public readonly nodeId: string;

  protected get cornerRadius(): number {
    return -1;
  }
  protected get fontSize(): number {
    return 16;
  }
  protected get paddingX(): number {
    return 20;
  }
  protected get paddingY(): number {
    return 10;
  }

  public get nodeWidth(): number {
    return this.bg.width;
  }

  public get nodeHeight(): number {
    return this.bg.height;
  }

  constructor(nodeId: string, title: string) {
    super();
    this.nodeId = nodeId;

    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    const titleText = new PIXI.Text({
      text: title,
      style: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: this.fontSize,
        fontWeight: "normal",
        lineHeight: this.fontSize,
        fill: COLOURS.nodeText,
      },
      resolution: Math.max(window.devicePixelRatio, 2),
    });
    titleText.position.set(this.paddingX, this.paddingY);
    this.addChild(titleText);

    const height = titleText.height + this.paddingY * 2;
    const finalRadius =
      this.cornerRadius === -1 ? height / 2 : this.cornerRadius;
    const width = titleText.width + this.paddingX * 2;

    this.bg.roundRect(0, 0, width, height, finalRadius);
    this.bg.fill({ color: COLOURS.nodeBg });
    this.bg.stroke({ color: COLOURS.nodeBorder, width: 1 });

    this.pivot.set(0, height / 2);
  }
}
