// Domain type stubs. These mirror the Go `libs/domain` shapes and will be
// replaced by the Wails-generated bindings once Phase 3 lands. Kept here
// (not in the stores) so every store and component imports the same shape.

export interface TestFile {
  graph: TestGraph;
  code?: { valid: boolean };
}

export interface TestGraph {
  start: string;
  nodes: Record<string, TestNode>;
  edges: { from: string; to: string }[];
}

export interface TestNode {
  id: string;
  title: string;
  info?: string;
  data?: string;
  config?: { visualCompare?: boolean };
  graph?: boolean;
}

export interface ProvarConfig {
  vars?: Record<string, string>;
  browser?: Record<string, unknown>;
}

export interface AppSettings {
  provider?: string;
  apiKey?: string;
  recentProjects?: string[];
}
