/**
 * TaskConfig contains step-level execution configuration overrides.
 */
export interface TaskConfig {
  visualCompare?: boolean;
}

/**
 * Task represents a single step in a test graph with metadata, execution transitions, and optional sub-graphs.
 */
export interface Task {
  id: string;
  title: string;
  info: string;
  next: string[];
  config?: TaskConfig;
  code?: string;
  graph?: Graph;
}

/**
 * Graph represents a collection of tasks and their valid execution paths.
 */
export interface Graph {
  info: string;
  start: string;
  tasks: Record<string, Task>;
  paths: Path[];
}

/**
 * File represents a test file containing name, path, graph structure, and compiled code status.
 */
export interface File extends Graph {
  name: string;
  path: string;
  code?: { valid: boolean } | null;
}

/**
 * Path represents a linear sequence of tasks representing a unique test scenario execution.
 */
export interface Path {
  tasks: Task[];
}

/**
 * Project represents a loaded Provar project containing project variables and test files.
 */
export interface Project {
  path: string;
  variables: Record<string, string>;
  files: File[];
}

/**
 * ExecutableTask represents a task with an executable function bound to it.
 */
export interface ExecutableTask<T = unknown> extends Task {
  execute: (api: T) => Promise<void>;
}

/**
 * ExecutableFile represents a test file with its tasks compiled into executable functions.
 */
export interface ExecutableFile<T = unknown> extends File {
  tasks: Record<string, ExecutableTask<T>>;
  code: { valid: boolean } | null;
}
