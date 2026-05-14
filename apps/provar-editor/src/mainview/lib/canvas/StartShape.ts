import * as PIXI from 'pixi.js';
import { NodeShape } from './NodeShape';
import { GRAPH_START_ID } from './constants';

export class StartShape extends NodeShape {
	constructor(onClick: (id: string) => void) {
		super(GRAPH_START_ID, 'Start');

		this.eventMode = 'static';
		this.cursor = 'pointer';

		this.hitArea = new PIXI.Rectangle(0, 0, this.bg.width, this.bg.height);

		this.on('pointerdown', (e) => {
			e.stopPropagation();
			onClick(GRAPH_START_ID);
		});
	}
}
