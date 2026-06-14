import * as PIXI from "pixi.js";
import type { TestFile } from "@libs/domain/zod";
import { GraphRenderer } from "./graph-renderer";
import { LAYOUT, type TaskState } from "./constants";
import { Viewport } from "./viewport";

/**
 * InfiniteCanvas controls the underlying PIXI application viewport and
 * tiling background.
 */
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

    this.viewport.on("pointertap", (e) => {
      if (e.target === this.viewport) {
        this.onNodeSelect?.(null);
      }
    });

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
    tileG.destroy();
    this.tilingSprite = new PIXI.TilingSprite({
      texture: tileTexture,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
  }

  private tick() {
    if (!this.app || !this.tilingSprite || !this.viewport) return;

    this.tilingSprite.width = this.app.screen.width;
    this.tilingSprite.height = this.app.screen.height;
    this.tilingSprite.tileScale.set(this.viewport.scale.x);
    this.tilingSprite.tilePosition.set(this.viewport.x, this.viewport.y);
  }

  public renderGraph(
    testFile: TestFile,
    taskStates: Record<string, TaskState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    > = {},
  ) {
    this.clearGraph();
    if (!this.shapeContainer || !this.app || !this.viewport) return;

    this.currentGraphRenderer = new GraphRenderer(
      testFile,
      taskStates,
      runningPathNodeIds,
      this.app.ticker,
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

  /**
   * updateGraphState re-strokes the existing graph in-place for state
   * changes (task start/finish/fail, compile progress) without rebuilding
   * the whole scene graph. Cheaper than renderGraph and only valid for
   * state-only mutations — structural changes (different testFile) still
   * go through renderGraph.
   */
  public updateGraphState(
    taskStates: Record<string, TaskState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    > = {},
  ): void {
    if (!this.currentGraphRenderer) return;
    this.currentGraphRenderer.setState(
      taskStates,
      runningPathNodeIds,
      compilationStates,
    );
  }

  private clearGraph() {
    if (!this.shapeContainer) return;

    if (this.currentGraphRenderer) {
      this.shapeContainer.removeChild(this.currentGraphRenderer);
      this.currentGraphRenderer.destroy({ children: true });
      this.currentGraphRenderer = null;
    }
  }

  public async destroy(): Promise<void> {
    this.viewport?.destroy();
    this.app?.destroy(true, { children: true });
  }
}
