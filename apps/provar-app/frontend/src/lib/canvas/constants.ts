export const GRAPH_START_ID = '__start__';

/** ActionState represents the execution state of an action or connector. */
export type ActionState =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'mixed'
  | 'compiling'
  | 'compiled';

export const COLOURS = {
  canvasBg: 0x000000,
  nodeBg: 0x1e293b,
  nodeBorder: 0x334155,
  nodeText: 0xf8fafc,
  connector: 0x424754,
  iconNeutral: 0x94a3b8,
  assertGreen: 0x10b981,
  primary: 0x3b82f6,
  onPrimary: 0xffffff,
  stateMixed: 0xf97316,
} as const;

export const TYPOGRAPHY = {
  fontFamily: 'Geist, sans-serif',
  textScaleFactor: 4,
} as const;

export const LAYOUT = {
  horizontalGap: 96,
  verticalSpacing: 56,
  initialOffsetX: 340,
  iconSpacing: 6,
  iconSize: 10,
  descriptionFontSize: 11,
  descriptionMaxLines: 2,
  sectionGap: 6,
  iconRowHeight: 14,
} as const;

export const CONNECTOR = {
  arrowSize: 6,
  lineWidth: 2,
  startGap: 1,
  endGap: 2,
} as const;