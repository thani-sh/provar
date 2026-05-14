import * as PIXI from 'pixi.js';
import { COLOURS, CONNECTOR } from './constants';

export class ConnectorShape extends PIXI.Graphics {
	constructor(
		startX: number,
		startY: number,
		endX: number,
		endY: number,
		type: 'horizontal' | 'vertical' = 'horizontal'
	) {
		super();

		this.moveTo(startX, startY);

		if (type === 'horizontal') {
			const curveStrength = Math.abs(endX - startX) / 2;
			this.bezierCurveTo(startX + curveStrength, startY, endX - curveStrength, endY, endX, endY);

			this.lineTo(endX - CONNECTOR.arrowSize, endY - CONNECTOR.arrowSize);
			this.moveTo(endX, endY);
			this.lineTo(endX - CONNECTOR.arrowSize, endY + CONNECTOR.arrowSize);
		} else {
			this.lineTo(endX, endY);
		}

		this.stroke({
			color: COLOURS.connector,
			width: CONNECTOR.lineWidth,
			cap: 'round',
			join: 'round'
		});
	}
}
