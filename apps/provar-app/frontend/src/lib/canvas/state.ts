import { GRAPH_START_ID, type TaskState } from './constants';

export type ConnectorState = 'idle' | 'running' | 'success' | 'failed' | 'mixed';

/** normalizeState maps a TaskState to the narrower ConnectorState. */
export function normalizeState(state: TaskState): ConnectorState {
  switch (state) {
    case 'running':
    case 'compiling':
      return 'running';
    case 'success':
    case 'compiled':
      return 'success';
    case 'failed':
      return 'failed';
    case 'mixed':
      return 'mixed';
    default:
      return 'idle';
  }
}

/** edgeKey canonicalises a directed edge. */
export function edgeKey(from: string, to: string): string {
  return `${from}→${to}`;
}

/**
 * resolveNodeState computes the display state for a node id, given the
 * current task state map. Start and End use "idle" — they're not part
 * of the test execution.
 */
export function resolveNodeState(
  id: string,
  taskStates: Record<string, TaskState>,
): ConnectorState {
  if (id === GRAPH_START_ID || id.startsWith('end_')) return 'idle';
  return normalizeState(taskStates[id] ?? 'idle');
}

/**
 * computeConnectorState picks the worst-case state for an edge
 * (running > failed > mixed > success > idle). A running edge takes
 * precedence over its target's eventual state.
 */
export function computeConnectorState(
  from: string,
  to: string,
  taskStates: Record<string, TaskState>,
): ConnectorState {
  const a = resolveNodeState(from, taskStates);
  const b = resolveNodeState(to, taskStates);
  const order: Record<ConnectorState, number> = {
    running: 4,
    failed: 3,
    mixed: 2,
    success: 1,
    idle: 0,
  };
  return order[a] >= order[b] ? a : b;
}