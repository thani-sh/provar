import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import yaml from "js-yaml";
import type {
  Task,
  Graph,
  File,
  Path,
  Project,
  ExecutableTask,
  ExecutableFile,
} from "@libs/domain";
import { schemaForLoadedFile } from "@libs/domain/zod";

export interface ProjectLoader {
  readFile(filePath: string): Promise<ExecutableFile>;
}

// Deeply resolve nested ${ENV.VAR_NAME} placeholders
function resolveEnvVars(val: any): any {
  if (typeof val === "string") {
    const envMatch = val.match(/^\$\{ENV\.(.+)\}$/);
    if (envMatch && envMatch[1]) {
      return process.env[envMatch[1]] || "";
    }
    return val;
  } else if (Array.isArray(val)) {
    return val.map(resolveEnvVars);
  } else if (val && typeof val === "object") {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      resolved[k] = resolveEnvVars(v);
    }
    return resolved;
  }
  return val;
}

// Dynamically resolves all execution paths from a task graph definition
export function buildGraphPaths(
  start: string,
  tasks: Record<string, Task>,
): Path[] {
  const paths: Path[] = [];

  function traverse(
    currentNodeId: string,
    currentPath: Task[],
    visited: Set<string>,
  ) {
    if (visited.has(currentNodeId)) {
      paths.push({ tasks: [...currentPath] });
      return;
    }

    const task = tasks[currentNodeId];
    if (!task) {
      paths.push({ tasks: [...currentPath] });
      return;
    }

    const nextPath = [...currentPath, task];
    const newVisited = new Set(visited).add(currentNodeId);

    if (!task.next || task.next.length === 0) {
      paths.push({ tasks: nextPath });
      return;
    }

    for (const nextId of task.next) {
      traverse(nextId, nextPath, newVisited);
    }
  }

  if (start && tasks[start]) {
    traverse(start, [], new Set());
  }

  return paths;
}

// Helper to convert raw parsed YAML tasks into standard Task structures
function buildTasksMap(rawNodes: Record<string, any>): Record<string, Task> {
  const tasks: Record<string, Task> = {};
  for (const [id, raw] of Object.entries(rawNodes)) {
    tasks[id] = {
      id,
      title: raw.title || "",
      info: raw.info || "",
      next: Array.isArray(raw.next) ? raw.next : raw.next ? [raw.next] : [],
      config: raw.config
        ? {
            visualCompare: raw.config.visualCompare,
          }
        : undefined,
      code: raw.code,
      graph: raw.graph
        ? {
            info: raw.graph.info || "",
            start: raw.graph.start || "",
            tasks: buildTasksMap(raw.graph.nodes || {}),
            paths: [], // Subpaths populated on demand
          }
        : undefined,
    };
  }
  return tasks;
}

export function parseTestFile(content: string, filePath: string): File {
  const doc = yaml.load(content) as any;
  if (!doc || typeof doc !== "object") {
    throw new Error(`Invalid test graph format in: ${filePath}`);
  }

  const name = doc.name || path.basename(filePath, ".test.yml");
  const rawGraph = doc.graph || {};
  const tasks = buildTasksMap(rawGraph.nodes || {});
  const start = rawGraph.start || "";
  const info = rawGraph.info || "";

  // Resolve unique linear execution paths
  const paths = buildGraphPaths(start, tasks);

  // Check code status (exists/valid hash) on the project level when parsing a test file
  const tsPath = filePath.replace(".test.yml", ".test.ts");
  let code: { valid: boolean } | null = null;
  if (fs.existsSync(tsPath)) {
    const tsContent = fs.readFileSync(tsPath, "utf-8");
    const yamlHash = crypto.createHash("sha256").update(content).digest("hex");
    const hashMatch = tsContent.match(/^\/\/ hash: ([a-f0-9]+)/);
    const valid = !!(hashMatch && hashMatch[1] === yamlHash);
    code = { valid };
  }

  const fileData = {
    name,
    path: filePath,
    info,
    start,
    tasks,
    paths,
    code,
  };

  return schemaForLoadedFile.parse(fileData);
}

export async function loadProject(
  projectPath: string,
): Promise<Project & ProjectLoader> {
  let current = path.resolve(projectPath);
  const rootDir = path.parse(current).root;
  let provarPath = "";

  // Crawl up to locate .provar directory
  while (current && current !== rootDir) {
    const candidate = path.join(current, ".provar");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      provarPath = candidate;
      break;
    }
    current = path.dirname(current);
  }

  if (!provarPath) {
    throw new Error(
      `Could not find a '.provar' workspace directory at or above: ${projectPath}`,
    );
  }

  // Load config.yml
  let variables: Record<string, string> = {};
  const configPath = path.join(provarPath, "config.yml");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    const doc = yaml.load(content) as any;
    const resolved = resolveEnvVars(doc);
    variables = resolved.variables || {};
  }

  // Scan tests
  const testsPath = path.join(provarPath, "tests");
  const files: File[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".test.yml")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = parseTestFile(content, fullPath);
        files.push(parsed);
      }
    }
  }

  scan(testsPath);

  const project: Project = {
    path: provarPath,
    variables,
    files,
  };

  const loader: ProjectLoader = {
    async readFile(filePath: string): Promise<ExecutableFile> {
      const content = fs.readFileSync(filePath, "utf-8");
      const baseFile = parseTestFile(content, filePath);

      if (!baseFile.code) {
        return {
          ...baseFile,
          tasks: baseFile.tasks as Record<string, ExecutableTask>,
          code: null,
        };
      }

      const tsPath = filePath.replace(".test.yml", ".test.ts");
      // Read dynamic TS module to export compiled task mapping.
      const compiledModule = await import(tsPath);
      const compiledTasks = compiledModule.tasks || {};

      for (const [id, task] of Object.entries(baseFile.tasks)) {
        const execFn = compiledTasks[id];
        if (!execFn) {
          throw new Error(
            `Mismatch: Task '${id}' is defined in ${path.basename(filePath)} but has no compiled function in the TypeScript file. Please recompile.`,
          );
        }
        (task as any).execute = execFn;
      }

      // Explicitly bind execute function to tasks inside resolved paths too
      // (Zod parsing clones objects so they need separate bindings).
      for (const resolvedPath of baseFile.paths) {
        for (const task of resolvedPath.tasks) {
          const execFn = compiledTasks[task.id];
          if (execFn) {
            (task as any).execute = execFn;
          }
        }
      }

      return {
        ...baseFile,
        tasks: baseFile.tasks as Record<string, ExecutableTask>,
        code: baseFile.code,
      };
    },
  };

  return {
    ...project,
    ...loader,
  };
}
