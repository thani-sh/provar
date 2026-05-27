export interface Task {
  id: string;
  title: string;
  info: string;
  next: string[];
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
}

export interface Path {
  tasks: Task[];
}

export interface Project {
  path: string;
  variables: Record<string, string>;
  files: File[];
}
