import * as PIXI from "pixi.js";
import { COLOURS, CONNECTOR, TYPOGRAPHY, type TaskState } from "./constants";

export class ConnectorShape extends PIXI.Container {
  private readonly line = new PIXI.Graphics();
  private readonly hitAreaLine = new PIXI.Graphics();
  private readonly addButton: PIXI.Container;
  private readonly onAdd?: () => void;

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

    const lineColor = state === "success" ? 0x10b981 : COLOURS.connector;
    const lineAlpha = state === "success" ? 0.8 : 1.0;
    this.addChild(this.hitAreaLine);
    this.addChild(this.line);

    this.line.moveTo(startX, startY);

    let midX = (startX + endX) / 2;
    let midY = (startY + endY) / 2;

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

      // Calculate midpoint of cubic bezier at t=0.5
      const p0x = startX,
        p0y = startY;
      const p1x = startX + curveStrength,
        p1y = startY;
      const p2x = endX - curveStrength,
        p2y = endY;
      const p3x = endX,
        p3y = endY;

      midX = 0.125 * p0x + 0.375 * p1x + 0.375 * p2x + 0.125 * p3x;
      midY = 0.125 * p0y + 0.375 * p1y + 0.375 * p2y + 0.125 * p3y;
    } else {
      this.line.lineTo(endX, endY);
    }

    this.line.stroke({
      color: lineColor,
      width: CONNECTOR.lineWidth,
      cap: "round",
      join: "round",
    });
    this.line.alpha = lineAlpha;

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
      this.line.stroke({
        color: COLOURS.primary,
        width: CONNECTOR.lineWidth + 1,
      });
    });

    this.on("pointerout", () => {
      this.addButton.visible = false;
      this.line.stroke({
        color: lineColor,
        width: CONNECTOR.lineWidth,
      });
      this.line.alpha = lineAlpha;
    });
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
