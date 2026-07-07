import { Container, Graphics, type Ticker } from 'pixi.js';
import { COLOURS, LAYOUT, type TaskState } from './constants';
import type { TestNode } from '../types';

export interface IconRow {
  container: Container;
  /** optional tick to unregister when the parent is destroyed */
  tick?: () => void;
}

/**
 * buildIconRow returns a populated Container of status / flag icons for
 * a task node. Pure: the only stateful bit is the optional spinner tick,
 * which the caller registers on a Ticker and unregisters on destroy.
 */
export function buildIconRow(
  state: TaskState,
  node: Pick<TestNode, 'graph' | 'config'>,
  ticker: Ticker,
): IconRow {
  const container = new Container();
  const icons: Graphics[] = [];

  const addIcon = (draw: (g: Graphics) => void, alpha = 0.5) => {
    const g = new Graphics();
    draw(g);
    g.alpha = alpha;
    icons.push(g);
    container.addChild(g);
  };

  let tick: (() => void) | undefined;

  if (state === 'success' || state === 'compiled') {
    addIcon((g) => {
      g.moveTo(2, 5);
      g.lineTo(5, 8);
      g.lineTo(9, 2);
      g.stroke({ color: 0x10b981, width: 2, join: 'round', cap: 'round' });
    }, 1.0);
  } else if (state === 'failed') {
    addIcon((g) => {
      g.moveTo(2, 2);
      g.lineTo(8, 8);
      g.moveTo(8, 2);
      g.lineTo(2, 8);
      g.stroke({ color: 0xef4444, width: 2, join: 'round', cap: 'round' });
    }, 1.0);
  } else if (state === 'running' || state === 'compiling') {
    const spinner = new Graphics();
    spinner.alpha = 1.0;
    icons.push(spinner);
    container.addChild(spinner);

    let angle = 0;
    const ARC_SPAN = Math.PI * 1.2;
    const cx = 5,
      cy = 5,
      r = 4;

    tick = () => {
      angle += 0.08;
      spinner.clear();
      spinner.arc(cx, cy, r, angle, angle + ARC_SPAN);
      const color = state === 'compiling' ? 0xf59e0b : 0x3b82f6;
      spinner.stroke({ color, width: 1.5, cap: 'round' });
    };
    ticker.add(tick);
  }

  if (node.graph) {
    addIcon((g) => {
      g.rect(1, 1, 3, 3);
      g.rect(6, 6, 3, 3);
      g.moveTo(4, 4);
      g.lineTo(6, 6);
      g.stroke({
        color: COLOURS.iconNeutral,
        width: 1.5,
        join: 'round',
        cap: 'round',
      });
    });
  }

  if (node.config?.visualCompare) {
    addIcon((g) => {
      const cell = 2.5;
      const gap = 1;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          g.rect(col * (cell + gap), row * (cell + gap) + 0.5, cell, cell);
        }
      }
      g.fill({ color: COLOURS.assertGreen, alpha: 0.9 });
    }, 1.0);
  }

  // Horizontal layout
  let offsetX = 0;
  for (const icon of icons) {
    icon.x = offsetX;
    offsetX += LAYOUT.iconSize + LAYOUT.iconSpacing;
  }

  return { container, tick };
}