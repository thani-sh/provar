import type { Subprocess } from 'bun';

export class OutputAdapter {
	constructor(private process: Subprocess) {}

	getWriter() {
		return {
			write: async (chunk: Uint8Array) => {
				if (this.process.stdin) {
					(this.process.stdin as any).write(chunk);
					(this.process.stdin as any).flush();
				}
			},
			releaseLock: () => {},
		};
	}
}
