import * as PIXI from "pixi.js";
import type { TestFile } from "@libs/domain/zod";
import { GraphRenderer } from "./graph-renderer";
import { LAYOUT, type TaskState } from "./constants";
import { Viewport } from "./viewport";

/**
 * Maximum devicePixelRatio we'll render at. Capping at 2 cuts the
 * backbuffer to 4x the canvas area instead of 9x on 3x Retina displays.
 * On a graph editor the visual difference between 2x and 3x is invisible,
 * and a smaller backbuffer is meaningfully cheaper even on Canvas2D.
 */
const MAX_DPR = 2;

/**
 * InfiniteCanvas controls the underlying PIXI application viewport and
 * tiling background.
 *
 * Renderer: Canvas2D (PIXI 8 supports a Canvas2D backend as a first-class
 * alternative to WebGL/WebGPU). We force Canvas2D because WebGL contexts
 * on WebKit/macOS are aggressively reclaimed — context loss fires often,
 * recovery is unreliable, and sustained per-frame Graphics work
 * (especially the spinner redraws) reliably trips the GPU into dropping
 * the context. Canvas2D has no such failure mode: there is no GPU
 * context to lose. The trade-off is a slower redraw on huge graphs, but
 * for a graph editor with tens of nodes this is well within acceptable
 * range and well worth the stability.
 */
export class InfiniteCanvas {
  private app: PIXI.Application | null = null;
  private container: HTMLElement | null = null;
  private tilingSprite: PIXI.TilingSprite | null = null;
  private viewport: Viewport | null = null;
  private shapeContainer: PIXI.Container | null = null;
  private currentGraphRenderer: GraphRenderer | null = null;

  /**
   * Cached state key used to short-circuit updateGraphState calls that
   * would re-apply identical state. The Svelte $effect in Canvas.svelte
   * re-fires on every editorStore mutation (any task state change, any
   * running-path change), but most of those produce a derived
   * taskStates that is identical to the previous one. Without this
   * guard we re-stroke every node and every connector on every mutation.
   */
  private lastStateKey = "";

  public onNodeSelect?: (id: string | null) => void;
  public onAddNode?: (fromId: string | null, toId: string | null) => void;

  public async init(container: HTMLElement) {
    this.container = container;
    this.app = new PIXI.Application();

    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_DPR),
      autoDensity: true,
      // Force the Canvas2D backend. Without this preference, PIXI would
      // pick WebGL by default and we'd be right back to the context
      // loss problem on WebKit/macOS.
      preference: "canvas",
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

    // Tear down any existing background so we don't leak the previous
    // texture and the source Graphics object. Both are recreated below.
    if (this.tilingSprite) {
      this.app.stage.removeChild(this.tilingSprite);
      const oldTexture = this.tilingSprite.texture;
      this.tilingSprite.destroy();
      // TilingSprite.destroy does not destroy the texture it references,
      // so we have to do it ourselves to avoid leaks across rebuilds.
      oldTexture?.destroy(true);
      this.tilingSprite = null;
    }

    const tileG = new PIXI.Graphics();
    tileG.rect(0, 0, 10, 10).fill({ color: 0x000000, alpha: 0 });
    tileG.circle(5, 5, 1).fill({ color: 0xffffff, alpha: 0.075 });

    const tileTexture = this.app.renderer.generateTexture(tileG);
    // The source Graphics has been baked into the texture — destroy it
    // so it does not linger.
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
    this.lastTaskStates = taskStates;
    this.lastRunningPathNodeIds = new Set(runningPathNodeIds);
    this.lastCompilationStates = { ...compilationStates };
    // New graph structure → previous state-key fingerprint is no longer
    // valid for the new set of nodes/connectors. Clear it so the
    // upcoming in-place update is not skipped as a no-op.
    this.lastStateKey = "";

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
   * without destroying or recreating any PIXI objects. Use this for
   * state changes (task start/finish/fail, compile progress) — it is
   * cheap. Only use renderGraph when the graph structure itself changes
   * (different testFile).
   */
  public updateGraphState(
    taskStates: Record<string, TaskState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    > = {},
  ): void {
    this.lastTaskStates = taskStates;
    this.lastRunningPathNodeIds = new Set(runningPathNodeIds);
    this.lastCompilationStates = { ...compilationStates };

    // Skip the work entirely if nothing meaningful has changed. The
    // $effect in Canvas.svelte re-fires on every editorStore mutation
    // (any task state change, any running-path change), but most of
    // those produce a derived taskStates that is identical to the
    // previous one.
    const stateKey = this.computeStateKey(
      taskStates,
      runningPathNodeIds,
      compilationStates,
    );
    if (stateKey === this.lastStateKey) return;
    this.lastStateKey = stateKey;

    if (!this.currentGraphRenderer) return;
    this.currentGraphRenderer.setState(
      taskStates,
      runningPathNodeIds,
      compilationStates,
    );
  }

  /**
   * computeStateKey builds a deterministic string fingerprint of the
   * inputs to updateGraphState. The set serialisation is O(n log n) but
   * node counts are small (tens, not thousands) so this is fine.
   */
  private computeStateKey(
    taskStates: Record<string, TaskState>,
    runningPathNodeIds: Set<string>,
    compilationStates: Record<
      string,
      "compiling" | "compiled" | "failed" | "idle"
    >,
  ): string {
    const taskParts: string[] = [];
    for (const id of Object.keys(taskStates).sort()) {
      taskParts.push(`${id}:${taskStates[id]}`);
    }
    const pathParts = Array.from(runningPathNodeIds).sort();
    const compileParts: string[] = [];
    for (const id of Object.keys(compilationStates).sort()) {
      compileParts.push(`${id}:${compilationStates[id]}`);
    }
    return `t[${taskParts.join(",")}]|p[${pathParts.join(",")}]|c[${compileParts.join(",")}]`;
  }

  public async destroy(): Promise<void> {
    this.viewport?.destroy();
    this.app?.destroy(true, { children: true });
  }

  private lastTaskStates: Record<string, TaskState> = {};
  private lastRunningPathNodeIds: Set<string> = new Set();
  private lastCompilationStates: Record<
    string,
    "compiling" | "compiled" | "failed" | "idle"
  > = {};
}
