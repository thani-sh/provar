export const GRAPH_START_ID = '__start__';

export const COLOURS = {
	nodeBg: 0x1e293b,
	nodeBorder: 0x334155,
	nodeText: 0xf8fafc,
	connector: 0x424754,
	iconNeutral: 0x94a3b8,
	codeUpToDate: 0x10b981,
	codeOutdated: 0xf59e0b,
	assertGreen: 0x10b981
} as const;

export const TYPOGRAPHY = {
	fontFamily: 'Geist, sans-serif',
	textScaleFactor: 4
} as const;

export const LAYOUT = {
	horizontalGap: 64,
	verticalSpacing: 40,
	initialOffsetX: 340,
	iconAboveOffset: -16,
	iconSpacing: 6,
	iconSize: 10
} as const;

export const CONNECTOR = {
	arrowSize: 6,
	lineWidth: 2,
	startGap: 1,
	endGap: 2
} as const;
