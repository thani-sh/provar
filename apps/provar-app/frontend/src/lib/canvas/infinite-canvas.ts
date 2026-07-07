import { Application, Container, Graphics, TilingSprite } from 'pixi.js';
import { GraphRenderer } from './renderer';
import { LAYOUT, type ActionState } from './constants';
import { Viewport } from './viewport';
import type { TestFileView } from '../types';

/**
 * InfiniteCanvas controls the PIXI application, viewport, and the
 * current GraphRenderer. Owns the lifecycle: init, renderGraph,
 * updateGraphState (cheap in-place state updates), destroy.
 */
export class InfiniteCanvas {
  private app: Application | null = null;
  private viewport: Viewport | null = null;
  private shapeContainer: Container | null = null;
  private tilingSprite: TilingSprite | null = null;
  private currentRenderer: GraphRenderer | null = null;
  private container: HTMLElement | null = null;

  public onNodeSelect: ((id: string | null) => void) | undefined;
  public onAddNode:
    | ((fromId: string | null, toId: string | null) => void)
    | undefined;

  async init(container: HTMLElement) {
    this.container = container;

    // Wails's WKWebView occasionally loses the WebGL context on the
    // first attempt — most reproducibly when getContext races the
    // initial layout pass, but also inside Pixi's ParticleContainer
    // pipe when the GPU is slow to settle. Try the full quality
    // options first, then fall back to minimal settings so a single
    // context-lost blip doesn't tank the whole canvas.
    const optionSets = [
      {
        resizeTo: container,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
        roundPixels: false,
      },
      {
        resizeTo: container,
        backgroundAlpha: 0,
        resolution: 1,
        autoDensity: false,
        antialias: false,
        roundPixels: false,
      },
    ];

    let lastErr: unknown;
    for (const options of optionSets) {
      try {
        this.app = new Application();
        await this.app.init(options);
        container.appendChild(this.app.canvas);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        // Tear down the failed Application before trying the next
        // option set, otherwise the partially-initialised renderer
        // leaks.
        try {
          this.app?.destroy(true, { children: true });
        } catch {}
        this.app = null;
      }
    }
    if (lastErr || !this.app) throw lastErr ?? new Error("canvas init failed");

    this.viewport = new Viewport(this.app);
    this.shapeContainer = new Container();
    this.viewport.addChild(this.shapeContainer);

    this.viewport.on('pointertap', (e: { target: unknown }) => {
      if (e.target === this.viewport) this.onNodeSelect?.(null);
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
    const tileG = new Graphics();
    tileG.rect(0, 0, 10, 10).fill({ color: 0x000000, alpha: 0 });
    tileG.circle(5, 5, 1).fill({ color: 0xffffff, alpha: 0.075 });
    const tileTexture = this.app.renderer.generateTexture(tileG);
    tileG.destroy();
    this.tilingSprite = new TilingSprite({
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

  renderGraph(file: TestFileView, actionStates: Record<string, ActionState> = {}) {
    this.clearGraph();
    if (!this.shapeContainer || !this.app || !this.viewport) return;

    this.currentRenderer = new GraphRenderer(
      file,
      actionStates,
      new Set(),
      this.app.ticker,
      (id) => this.onNodeSelect?.(id),
      (from, to) => this.onAddNode?.(from, to),
    );
    this.shapeContainer.addChild(this.currentRenderer);

    this.viewport.x = LAYOUT.initialOffsetX;
    this.viewport.y = this.app.screen.height / 2;
    this.viewport.scale.set(1);
  }

  updateGraphState(
    actionStates: Record<string, ActionState> = {},
    runningPathNodeIds: Set<string> = new Set(),
    compilationStates: Record<string, 'compiling' | 'compiled' | 'failed' | 'idle'> = {},
  ) {
    this.currentRenderer?.setState(actionStates, runningPathNodeIds, compilationStates);
  }

  private clearGraph() {
    if (!this.shapeContainer) return;
    if (this.currentRenderer) {
      this.shapeContainer.removeChild(this.currentRenderer);
      this.currentRenderer.destroy({ children: true });
      this.currentRenderer = null;
    }
  }

  async destroy() {
    this.viewport?.destroy();
    this.app?.destroy(true, { children: true });
    if (this.container && this.app?.canvas && this.container.contains(this.app.canvas)) {
      this.container.removeChild(this.app.canvas);
    }
  }
}