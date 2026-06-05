import * as PIXI from "pixi.js";
import { COLOURS, LAYOUT, TYPOGRAPHY, type TaskState } from "./constants";

/** NodeShape is the base visual container for graph nodes. */
export class NodeShape extends PIXI.Container {
  protected bg: PIXI.Graphics;
  /** iconRow is the container child classes place their icons into. */
  protected iconRow: PIXI.Container;
  public readonly nodeId: string;

  protected get cornerRadius(): number {
    return 8;
  }
  protected get fontSize(): number {
    return 13;
  }
  protected get paddingX(): number {
    return 14;
  }
  protected get paddingY(): number {
    return 11;
  }
  protected get minWidth(): number {
    return 180;
  }

  public get nodeWidth(): number {
    return this.bg.width;
  }

  public get nodeHeight(): number {
    return this.bg.height;
  }

  constructor(
    nodeId: string,
    title: string,
    description: string = "",
    state: TaskState = "idle",
  ) {
    super();
    this.nodeId = nodeId;

    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    const hasDescription = description.trim().length > 0;

    // --- Title ---
    const titleText = new PIXI.Text({
      text: title,
      style: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: this.fontSize,
        fontWeight: "500",
        lineHeight: this.fontSize * 1.4,
        fill: COLOURS.nodeText,
        wordWrap: false,
      },
      resolution: Math.max(window.devicePixelRatio, 2),
    });

    // First pass: measure title width to determine node width
    const contentWidth = Math.max(this.minWidth, titleText.width);
    const totalWidth = contentWidth + this.paddingX * 2;

    // --- Icon row placeholder (always created, child classes populate it) ---
    this.iconRow = new PIXI.Container();

    let totalHeight: number;

    if (hasDescription) {
      // --- Description (up to 2 lines) ---
      const descText = new PIXI.Text({
        text: description,
        style: {
          fontFamily: TYPOGRAPHY.fontFamily,
          fontSize: LAYOUT.descriptionFontSize,
          fontWeight: "normal",
          lineHeight: LAYOUT.descriptionFontSize * 1.45,
          fill: COLOURS.nodeText,
          wordWrap: true,
          wordWrapWidth: contentWidth,
        },
        resolution: Math.max(window.devicePixelRatio, 2),
      });
      descText.alpha = 0.55;

      const descLineHeight = LAYOUT.descriptionFontSize * 1.45;
      const maxDescHeight = descLineHeight * LAYOUT.descriptionMaxLines;
      const descHeight = Math.min(descText.height, maxDescHeight);

      // Total inner height: title + gap + desc (clamped) + gap + icon row
      const innerHeight =
        titleText.height +
        LAYOUT.sectionGap +
        descHeight +
        LAYOUT.sectionGap +
        LAYOUT.iconRowHeight;

      totalHeight = innerHeight + this.paddingY * 2;
      const finalRadius =
        this.cornerRadius === -1 ? totalHeight / 2 : this.cornerRadius;

      this.bg.roundRect(0, 0, totalWidth, totalHeight, finalRadius);

      // Position title
      titleText.position.set(this.paddingX, this.paddingY);
      this.addChild(titleText);

      // Position description with optional mask for overflow
      const descY = this.paddingY + titleText.height + LAYOUT.sectionGap;
      descText.position.set(this.paddingX, descY);
      if (descText.height > maxDescHeight) {
        const mask = new PIXI.Graphics();
        mask.rect(this.paddingX, descY, contentWidth, maxDescHeight);
        mask.fill({ color: 0xffffff });
        this.addChild(mask);
        descText.mask = mask;
      }
      this.addChild(descText);

      // Position icon row at the bottom, vertically centred in reserved space
      const iconRowY =
        descY +
        descHeight +
        LAYOUT.sectionGap +
        (LAYOUT.iconRowHeight - LAYOUT.iconSize) / 2;
      this.iconRow.position.set(this.paddingX, iconRowY);
      this.addChild(this.iconRow);
    } else {
      // Compact layout for nodes without description (Start, End)
      totalHeight = titleText.height + this.paddingY * 2;
      const finalRadius =
        this.cornerRadius === -1 ? totalHeight / 2 : this.cornerRadius;

      this.bg.roundRect(0, 0, totalWidth, totalHeight, finalRadius);

      titleText.position.set(this.paddingX, this.paddingY);
      this.addChild(titleText);

      // iconRow is added but stays empty / hidden for compact nodes
      this.addChild(this.iconRow);
    }

    // Apply background fill and border
    this.bg.fill({ color: COLOURS.nodeBg });

    let borderColor: number = COLOURS.nodeBorder;
    let strokeWidth = 1;
    if (state === "running") {
      borderColor = 0x3b82f6;
      strokeWidth = 2;
    } else if (state === "success") {
      borderColor = 0x10b981;
      strokeWidth = 2;
    } else if (state === "failed") {
      borderColor = 0xef4444;
      strokeWidth = 2;
    } else if (state === "mixed") {
      borderColor = COLOURS.stateMixed;
      strokeWidth = 2;
    }
    this.bg.stroke({ color: borderColor, width: strokeWidth });

    // Pivot at vertical centre (used by graph layout)
    this.pivot.set(0, totalHeight / 2);
  }
}
