import { Container, Point, Rectangle, type Application } from 'pixi.js';

export class Viewport extends Container {
  private isDragging = false;
  private lastMousePos = new Point();
  private readonly minScale = 0.1;
  private readonly maxScale = 5;

  constructor(private readonly app: Application) {
    super();
    this.eventMode = 'static';

    this.hitArea = new Rectangle(
      0,
      0,
      this.app.screen.width,
      this.app.screen.height,
    );

    this.on('wheel', this.onWheel.bind(this));
    this.on('pointerdown', this.onPointerDown.bind(this));
    this.on('pointermove', this.onPointerMove.bind(this));
    this.on('pointerup', this.onPointerUp.bind(this));
    this.on('pointerupoutside', this.onPointerUp.bind(this));

    this.app.canvas.addEventListener('wheel', this.preventNativeWheel, {
      passive: false,
    });
    this.app.ticker.add(this.updateHitArea, this);
  }

  private preventNativeWheel = (e: WheelEvent) => {
    e.preventDefault();
  };

  private updateHitArea() {
    if (this.hitArea instanceof Rectangle) {
      const topLeft = this.toLocal({ x: 0, y: 0 });
      const bottomRight = this.toLocal({
        x: this.app.screen.width,
        y: this.app.screen.height,
      });

      this.hitArea.x = topLeft.x;
      this.hitArea.y = topLeft.y;
      this.hitArea.width = bottomRight.x - topLeft.x;
      this.hitArea.height = bottomRight.y - topLeft.y;
    }
  }

  private onWheel(e: WheelEvent & { deltaX: number; deltaY: number; clientX: number; clientY: number }): void {
    if (e.metaKey || e.ctrlKey) {
      const factor = Math.pow(2, -e.deltaY / 100);
      const newScale = Math.min(
        Math.max(this.scale.x * factor, this.minScale),
        this.maxScale,
      );
      const globalPt = { x: e.clientX, y: e.clientY };
      const mouseLocalPos = this.toLocal(globalPt);

      this.scale.set(newScale);

      const afterZoomGlobalPos = this.toGlobal(mouseLocalPos);
      this.x -= afterZoomGlobalPos.x - globalPt.x;
      this.y -= afterZoomGlobalPos.y - globalPt.y;
    } else {
      this.x -= e.deltaX;
      this.y -= e.deltaY;
    }
  }

  private onPointerDown(e: { button: number; pointerType: string; global: Point }): void {
    if (e.button === 0 || e.pointerType === 'touch') {
      this.isDragging = true;
      this.lastMousePos.copyFrom(e.global);
    }
  }

  private onPointerMove(e: { global: Point }): void {
    if (!this.isDragging) return;
    const dx = e.global.x - this.lastMousePos.x;
    const dy = e.global.y - this.lastMousePos.y;
    this.x += dx;
    this.y += dy;
    this.lastMousePos.copyFrom(e.global);
  }

  private onPointerUp(): void {
    this.isDragging = false;
  }

  public override destroy(options?: { children?: boolean }) {
    this.app.ticker.remove(this.updateHitArea, this);
    this.app.canvas.removeEventListener('wheel', this.preventNativeWheel);
    super.destroy(options);
  }
}