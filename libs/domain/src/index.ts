/**
 * TaskConfig contains step-level execution configuration overrides.
 */
export interface TaskConfig {
  visualCompare?: boolean;
}

export interface Task {
  id: string;
  title: string;
  info: string;
  next: string[];
  config?: TaskConfig;
  code?: string;
  graph?: Graph;
}

export interface Graph {
  info: string;
  start: string;
  tasks: Record<string, Task>;
  paths: Path[];
}

export interface File extends Graph {
  name: string;
  path: string;
  code?: { valid: boolean } | null;
}

export interface Path {
  tasks: Task[];
}

export interface Project {
  path: string;
  variables: Record<string, string>;
  files: File[];
}

export interface ExecutableTask<T = any> extends Task {
  execute: (api: T) => Promise<void>;
}

export interface ExecutableFile<T = any> extends File {
  tasks: Record<string, ExecutableTask<T>>;
  code: { valid: boolean } | null;
}

