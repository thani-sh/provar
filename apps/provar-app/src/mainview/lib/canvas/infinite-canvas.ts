import * as PIXI from "pixi.js";
import type { TestFile } from "@libs/domain/zod";
import { GraphRenderer } from "./graph-renderer";
import { LAYOUT, COLOURS, type TaskState } from "./constants";
import { Viewport } from "./viewport";

/**
 * InfiniteCanvas controls the underlying PIXI application viewport and tiling background.
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

    this.setupBackground();

    this.app.stage.addChild(this.tilingSprite!);
    this.app.stage.addChild(this.viewport);

    const rect = container.getBoundingClientRect();
    this.viewport.x = rect.width / 2;
    this.viewport.y = rect.height / 2;

    this.app.ticker.add(() => this.tick());

    // Recover gracefully from transient WebGL context loss (driver reset,
    // OS GPU handoff, etc.) instead of dying permanently.
    this.attachContextLossHandlers();
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

  public renderGraph(
    testFile: TestFile,
    taskStates: Record<string, TaskState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    > = {},
  ) {
    // Cache the latest state so we can re-apply on WebGL context restore.
    this.lastTaskStates = taskStates;
    this.lastRunningPathNodeIds = new Set(runningPathNodeIds);
    this.lastCompilationStates = { ...compilationStates };

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
   * updateGraphState updates the existing graph's visual state in-place
   * without destroying or recreating any PIXI objects. Use this for state
   * changes (task start/finish/fail, compile progress) — it is cheap and
   * does NOT stress the WebGL context. Only use renderGraph when the graph
   * structure itself changes (different testFile).
   */
  public updateGraphState(
    taskStates: Record<string, TaskState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    > = {},
  ): void {
    // Cache the latest state so we can re-apply on WebGL context restore.
    this.lastTaskStates = taskStates;
    this.lastRunningPathNodeIds = new Set(runningPathNodeIds);
    this.lastCompilationStates = { ...compilationStates };

    if (!this.currentGraphRenderer) return;
    this.currentGraphRenderer.setState(
      taskStates,
      runningPathNodeIds,
      compilationStates,
    );
  }

  public destroy() {
    this.detachContextLossHandlers();
    this.viewport?.destroy();
    this.app?.destroy();
  }

  /**
   * Browser-driven WebGL context loss (OS GPU reset, app focus loss,
   * driver crash) fires webglcontextlost. We must preventDefault on the
   * event so the browser knows we want to recover, and listen for the
   * matching webglcontextrestored so we can re-upload scene-graph state
   * to the new context. PIXI 8's renderer handles internal resource
   * rebuild, but we also re-apply current graph state so colours catch
   * up after the restore.
   */
  private contextLossHandler?: (e: Event) => void;
  private contextRestoredHandler?: (e: Event) => void;
  private lastTaskStates: Record<string, TaskState> = {};
  private lastRunningPathNodeIds: Set<string> = new Set();
  private lastCompilationStates: Record<
    string,
    "compiling" | "compiled" | "failed" | "idle"
  > = {};

  private attachContextLossHandlers(): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    this.contextLossHandler = (e: Event) => {
      // Prevent default so the browser will eventually fire webglcontextrestored
      e.preventDefault();
      console.warn("[InfiniteCanvas] WebGL context lost — awaiting restore");
    };
    this.contextRestoredHandler = () => {
      console.warn(
        "[InfiniteCanvas] WebGL context restored — re-applying state",
      );
      // Re-apply the last known graph state so colours are correct.
      if (this.currentGraphRenderer) {
        this.currentGraphRenderer.setState(
          this.lastTaskStates,
          this.lastRunningPathNodeIds,
          this.lastCompilationStates,
        );
      }
    };
    canvas.addEventListener("webglcontextlost", this.contextLossHandler);
    canvas.addEventListener(
      "webglcontextrestored",
      this.contextRestoredHandler,
    );
  }

  private detachContextLossHandlers(): void {
    if (!this.app) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    if (this.contextLossHandler) {
      canvas.removeEventListener("webglcontextlost", this.contextLossHandler);
      this.contextLossHandler = undefined;
    }
    if (this.contextRestoredHandler) {
      canvas.removeEventListener(
        "webglcontextrestored",
        this.contextRestoredHandler,
      );
      this.contextRestoredHandler = undefined;
    }
  }
}
