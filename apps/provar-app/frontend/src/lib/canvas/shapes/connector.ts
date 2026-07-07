import { Container, Graphics } from 'pixi.js';
import { COLOURS, CONNECTOR, type ActionState } from '../constants';

export class ConnectorShape extends Container {
  private readonly line = new Graphics();
  private readonly pathData: {
    type: 'horizontal' | 'vertical';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };

  private currentLineColor: number = COLOURS.connector;
  private currentLineAlpha: number = 1.0;

  constructor(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    type: 'horizontal' | 'vertical' = 'horizontal',
    state: ActionState = 'idle',
  ) {
    super();
    this.pathData = { type, startX, startY, endX, endY };
    this.addChild(this.line);
    this.drawLine(...this.resolveStyle(state));
  }

  private resolveStyle(state: ActionState): [number, number, number] {
    switch (state) {
      case 'compiling':
        return [0xf59e0b, 1.0, CONNECTOR.lineWidth];
      case 'running':
        return [0x3b82f6, 1.0, CONNECTOR.lineWidth];
      case 'success':
        return [0x10b981, 0.8, CONNECTOR.lineWidth];
      case 'failed':
        return [0xef4444, 1.0, CONNECTOR.lineWidth];
      default:
        return [COLOURS.connector, 1.0, CONNECTOR.lineWidth];
    }
  }

  private drawLine(color: number, alpha: number, width: number) {
    const { type, startX, startY, endX, endY } = this.pathData;
    this.line.clear();
    this.line.moveTo(startX, startY);
    if (type === 'horizontal') {
      const curve = Math.abs(endX - startX) / 2;
      this.line.bezierCurveTo(
        startX + curve,
        startY,
        endX - curve,
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
    this.line.stroke({ color, width, cap: 'round', join: 'round' });
    this.line.alpha = alpha;
  }

  public setState(state: ActionState): void {
    const [color, alpha, width] = this.resolveStyle(state);
    this.currentLineColor = color;
    this.currentLineAlpha = alpha;
    this.drawLine(color, alpha, width);
  }
}