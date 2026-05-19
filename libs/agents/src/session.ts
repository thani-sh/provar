import { ACPClient } from './client';
import type { Attachment, Session } from './types';

export class ACPSession implements Session {
	constructor(
		public id: string,
		private client: ACPClient,
	) {}

	async prompt(stuff: Attachment[]): Promise<Attachment[]> {
		const result = await this.client.prompt(this.id, stuff);

		return [
			{
				type: 'text',
				text: result.message,
			},
		];
	}
}
