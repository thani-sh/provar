// Canvas-local types. Shapes align with the Wails-generated wire types
// (domain.View / domain.Graph / domain.Node / domain.Edge in
// wailsjs/go/models.ts) so the binding output assigns cleanly into them.
//
// `Action` carries three editor-only fields — `data`, `config`, `graph` —
// that aren't in domain.Node yet. The domain model will learn about them
// in a later phase; until then the canvas reads them off the action and
// the editor store treats them as part of the file shape.

export interface TestFileView {
  graph: TestFileGraph;
}

export interface TestFileGraph {
  start: string;
  nodes: Record<string, Action>;
  edges: Edge[];
}

export interface Action {
  id: string;
  title: string;
  info?: string;
  data?: string;
  config?: { visualCompare?: boolean };
  graph?: boolean;
}

export interface Edge {
  from: string;
  to: string;
}