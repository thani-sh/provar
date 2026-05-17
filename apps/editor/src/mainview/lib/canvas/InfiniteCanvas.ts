import * as PIXI from "pixi.js";
import type { TestFile } from "../../../shared/domain";
import { GraphRenderer } from "./GraphRenderer";
import { LAYOUT, COLOURS } from "./constants";
import { Viewport } from "./Viewport";

export class InfiniteCanvas {
  private app: PIXI.Application | null = null;
  private container: HTMLElement | null = null;
  private tilingSprite: PIXI.TilingSprite | null = null;
  private viewport: Viewport | null = null;
  private shapeContainer: PIXI.Container | null = null;
  private currentGraphRenderer: GraphRenderer | null = null;

  public onNodeSelect?: (id: string | null) => void;
  public onAddNode?: (fromId: string | null, toId: string | null) => void;

  public async init(container: HTMLElement) {
    this.container = container;
    this.app = new PIXI.Application();

    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      roundPixels: false,
    });

    container.appendChild(this.app.canvas);

    this.viewport = new Viewport(this.app);
    this.shapeContainer = new PIXI.Container();
    this.viewport.addChild(this.shapeContainer);

    this.setupBackground();

    this.app.stage.addChild(this.tilingSprite!);
    this.app.stage.addChild(this.viewport);

    const rect = container.getBoundingClientRect();
    this.viewport.x = rect.width / 2;
    this.viewport.y = rect.height / 2;

    this.app.ticker.add(() => this.tick());
  }

  private setupBackground() {
    if (!this.app) return;
    const tileG = new PIXI.Graphics();
    tileG.rect(0, 0, 10, 10).fill({ color: 0x000000, alpha: 0 });
    tileG.circle(5, 5, 1).fill({ color: 0xffffff, alpha: 0.075 });

    const tileTexture = this.app.renderer.generateTexture(tileG);
    this.tilingSprite = new PIXI.TilingSprite({
      texture: tileTexture,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });

    this.viewport?.on("pointertap", (e) => {
      if (e.target === this.viewport) {
        this.onNodeSelect?.(null);
      }
    });
  }

  private tick() {
    if (!this.app || !this.tilingSprite || !this.viewport) return;

    this.tilingSprite.width = this.app.screen.width;
    this.tilingSprite.height = this.app.screen.height;
    this.tilingSprite.tileScale.set(this.viewport.scale.x);
    this.tilingSprite.tilePosition.set(this.viewport.x, this.viewport.y);
  }

  public clearGraph() {
    if (!this.shapeContainer) return;

    if (this.currentGraphRenderer) {
      this.shapeContainer.removeChild(this.currentGraphRenderer);
      this.currentGraphRenderer.destroy({ children: true });
      this.currentGraphRenderer = null;
    }
  }

  public renderGraph(testFile: TestFile) {
    this.clearGraph();
    if (!this.shapeContainer || !this.app || !this.viewport) return;

    this.currentGraphRenderer = new GraphRenderer(
      testFile,
      (id) => {
        this.onNodeSelect?.(id);
      },
      (fromId, toId) => {
        this.onAddNode?.(fromId, toId);
      },
    );
    this.shapeContainer.addChild(this.currentGraphRenderer);

    this.viewport.x = LAYOUT.initialOffsetX;
    this.viewport.y = this.app.screen.height / 2;
    this.viewport.scale.set(1);
  }

  public destroy() {
    this.viewport?.destroy();
    this.app?.destroy();
  }
}
