import * as PIXI from "pixi.js";
import { COLOURS, CONNECTOR, TYPOGRAPHY, type TaskState } from "./constants";

export class ConnectorShape extends PIXI.Container {
  private readonly line = new PIXI.Graphics();
  private readonly hitAreaLine = new PIXI.Graphics();
  private readonly addButton: PIXI.Container;
  private readonly onAdd?: () => void;

  // Cached path geometry for setState — avoids the line-stroke accumulation
  // that would happen if we re-issued .stroke() on each state change.
  private readonly pathData: {
    type: "horizontal" | "vertical";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };

  constructor(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    onAdd?: () => void,
    type: "horizontal" | "vertical" = "horizontal",
    state: TaskState = "idle",
  ) {
    super();
    this.onAdd = onAdd;
    this.pathData = { type, startX, startY, endX, endY };

    const { lineColor, lineAlpha } = this.resolveStyle(state);
    this.addChild(this.hitAreaLine);
    this.addChild(this.line);

    this.drawLine(lineColor, lineAlpha);

    let midX = (startX + endX) / 2;
    let midY = (startY + endY) / 2;

    if (type === "horizontal") {
      const curveStrength = Math.abs(endX - startX) / 2;
      midX =
        0.125 * startX +
        0.375 * (startX + curveStrength) +
        0.375 * (endX - curveStrength) +
        0.125 * endX;
      midY = 0.125 * startY + 0.375 * startY + 0.375 * endY + 0.125 * endY;
    }

    // Friendly hit area
    this.hitAreaLine.moveTo(startX, startY);
    if (type === "horizontal") {
      const curveStrength = Math.abs(endX - startX) / 2;
      this.hitAreaLine.bezierCurveTo(
        startX + curveStrength,
        startY,
        endX - curveStrength,
        endY,
        endX,
        endY,
      );
    } else {
      this.hitAreaLine.lineTo(endX, endY);
    }
    this.hitAreaLine.stroke({
      color: 0x000000,
      width: 20,
      alpha: 0,
    });

    this.addButton = this.createAddButton();
    this.addButton.position.set(midX, midY);
    this.addButton.visible = false;
    this.addChild(this.addButton);

    this.eventMode = "static";
    this.cursor = "pointer";

    this.on("pointerover", () => {
      this.addButton.visible = true;
      this.drawLine(COLOURS.primary, 1.0, CONNECTOR.lineWidth + 1);
    });

    this.on("pointerout", () => {
      this.addButton.visible = false;
      this.drawLine(this.currentLineColor, this.currentLineAlpha);
    });
  }

  private currentLineColor: number = COLOURS.connector;
  private currentLineAlpha: number = 1.0;

  /**
   * resolveStyle maps a TaskState to the (color, alpha) pair used for the
   * connector line. The palette mirrors the node palette exactly so a
   * connector always reads as "the state of the edge between two nodes":
   *   - compiling → yellow (in-flight compile)
   *   - running   → blue   (in-flight test run)
   *   - success   → green
   *   - failed    → red
   *   - anything else → neutral connector colour
   */
  private resolveStyle(state: TaskState): {
    lineColor: number;
    lineAlpha: number;
  } {
    switch (state) {
      case "compiling":
        return { lineColor: 0xf59e0b, lineAlpha: 1.0 };
      case "running":
        return { lineColor: 0x3b82f6, lineAlpha: 1.0 };
      case "success":
        return { lineColor: 0x10b981, lineAlpha: 0.8 };
      case "failed":
        return { lineColor: 0xef4444, lineAlpha: 1.0 };
      default:
        return { lineColor: COLOURS.connector, lineAlpha: 1.0 };
    }
  }

  /**
   * drawLine re-issues the cached path with a new stroke style. We always
   * call clear() first because PIXI 8's Graphics accumulates geometry on
   * every stroke, and we want to avoid that leak.
   */
  private drawLine(
    color: number,
    alpha: number,
    width: number = CONNECTOR.lineWidth,
  ): void {
    const { type, startX, startY, endX, endY } = this.pathData;
    this.line.clear();
    this.line.moveTo(startX, startY);

    if (type === "horizontal") {
      const curveStrength = Math.abs(endX - startX) / 2;
      this.line.bezierCurveTo(
        startX + curveStrength,
        startY,
        endX - curveStrength,
        endY,
        endX,
        endY,
      );
      this.line.lineTo(endX - CONNECTOR.arrowSize, endY - CONNECTOR.arrowSize);
      this.line.moveTo(endX, endY);
      this.line.lineTo(endX - CONNECTOR.arrowSize, endY + CONNECTOR.arrowSize);
    } else {
      this.line.lineTo(endX, endY);
    }

    this.line.stroke({
      color,
      width,
      cap: "round",
      join: "round",
    });
    this.line.alpha = alpha;
  }

  /**
   * setState updates the line color in-place when the connector's effective
   * state changes. The PIXI.Graphics object is reused; we clear+re-stroke
   * with cached path coordinates. The browser still has to re-upload the
   * GPU buffer, but the PIXI object is the same — much cheaper than the
   * full GraphRenderer rebuild we used to do on every state change.
   */
  public setState(state: TaskState): void {
    const { lineColor, lineAlpha } = this.resolveStyle(state);
    this.currentLineColor = lineColor;
    this.currentLineAlpha = lineAlpha;
    this.drawLine(lineColor, lineAlpha);
  }

  private createAddButton(): PIXI.Container {
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "pointer";

    const bg = new PIXI.Graphics();
    bg.circle(0, 0, 10);
    bg.fill({ color: COLOURS.canvasBg });
    bg.stroke({ color: COLOURS.connector, width: 1.5 });
    container.addChild(bg);

    const plus = new PIXI.Graphics();
    plus.moveTo(-4, 0);
    plus.lineTo(4, 0);
    plus.moveTo(0, -4);
    plus.lineTo(0, 4);
    plus.stroke({ color: COLOURS.connector, width: 1.5, cap: "round" });
    container.addChild(plus);

    container.on("pointerdown", (e) => {
      e.stopPropagation();
      this.onAdd?.();
    });

    container.on("pointerover", () => {
      bg.stroke({ color: COLOURS.primary, width: 1.5 });
      plus.stroke({ color: COLOURS.primary, width: 1.5, cap: "round" });
    });

    container.on("pointerout", () => {
      bg.stroke({ color: COLOURS.connector, width: 1.5 });
      plus.stroke({ color: COLOURS.connector, width: 1.5, cap: "round" });
    });

    return container;
  }
}
