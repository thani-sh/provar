import { z } from "zod";
import type { Task, Graph, File, Path, Project } from "./index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * PROVAR_DIR is the default directory name containing Provar configuration and tests.
 */
export const PROVAR_DIR = ".provar";

/**
 * TESTS_DIR is the directory path where Provar test files are located.
 */
export const TESTS_DIR = `${PROVAR_DIR}/tests`;

/**
 * CONFIG_FILE is the configuration file path for the Provar workspace.
 */
export const CONFIG_FILE = `${PROVAR_DIR}/config.yml`;

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------
const coerceStringToArray = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => (typeof val === "string" ? [val] : val));

/**
 * schemaForTaskConfig validates task-specific configuration overrides.
 */
export const schemaForTaskConfig = z.object({
  visualCompare: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Raw Serialized Schemas (Test YAML format on disk)
// ---------------------------------------------------------------------------

/**
 * TestNode represents a raw node structure serialized in YAML format on disk.
 */
export type TestNode = {
  title: string;
  info: string;
  next?: string | string[];
  config?: z.infer<typeof schemaForTaskConfig>;
  graph?: TestFileGraph;
  hasGeneratedCode?: boolean;
  isUpToDate?: boolean;
  screenshotUrl?: string;
};

/**
 * schemaForTask is the Zod schema validating a serialized task node.
 */
export const schemaForTask: z.ZodType<TestNode, any, any> = z.lazy(() =>
  z.object({
    title: z.string(),
    info: z.string(),
    next: z.union([z.string(), z.array(z.string())]).optional(),
    config: schemaForTaskConfig.optional(),
    graph: z.lazy(() => schemaForGraph).optional(),
    hasGeneratedCode: z.boolean().optional(),
    isUpToDate: z.boolean().optional(),
    screenshotUrl: z.string().optional(),
  }),
);

/**
 * TestFileGraph represents a collection of serialized test nodes and their metadata.
 */
export type TestFileGraph = {
  info: string;
  start: string;
  nodes: Record<string, TestNode>;
};

/**
 * schemaForGraph is the Zod schema validating a serialized task graph.
 */
export const schemaForGraph: z.ZodType<TestFileGraph, any, any> = z.lazy(() =>
  z.object({
    info: z.string(),
    start: z.string(),
    nodes: z.record(z.string().regex(/^task_[a-z0-9]{5}$/), schemaForTask),
  }),
);

/**
 * schemaForFile is the Zod schema validating a serialized test file structure.
 */
export const schemaForFile = z.object({
  name: z.string(),
  graph: schemaForGraph,
  code: z.object({ valid: z.boolean() }).nullable().optional(),
});

/**
 * TestFile represents a serialized test file structure validated by schemaForFile.
 */
export type TestFile = z.infer<typeof schemaForFile>;

/**
 * configSchema validates the global .provar/config.yml configuration on disk.
 */
export const configSchema = z.object({
  variables: z.record(z.string(), z.any()).optional(),
});

/**
 * ProvarConfig represents the parsed and validated configSchema.
 */
export type ProvarConfig = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Loaded Runtime Schemas (Memory representation used by Loader/Compiler)
// ---------------------------------------------------------------------------

/**
 * schemaForLoadedTask is the Zod schema validating runtime loaded Task objects.
 */
export const schemaForLoadedTask: z.ZodType<Task, any, any> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    info: z.string(),
    next: coerceStringToArray,
    config: schemaForTaskConfig.optional(),
    code: z.string().optional(),
    graph: z.lazy(() => schemaForLoadedGraph).optional(),
  }),
);

const baseLoadedGraphSchema = z.object({
  info: z.string(),
  start: z.string(),
  tasks: z.record(z.string(), schemaForLoadedTask),
  paths: z.array(z.lazy(() => schemaForPath)),
});

/**
 * schemaForLoadedGraph is the Zod schema validating runtime loaded Graph objects.
 */
export const schemaForLoadedGraph: z.ZodType<Graph, any, any> = z.lazy(
  () => baseLoadedGraphSchema,
);

/**
 * schemaForLoadedFile is the Zod schema validating runtime loaded File objects.
 */
export const schemaForLoadedFile: z.ZodType<File, any, any> = z.lazy(() =>
  baseLoadedGraphSchema.extend({
    name: z.string(),
    path: z.string(),
    code: z.object({ valid: z.boolean() }).nullable().optional(),
  }),
);

/**
 * schemaForLoadedFileMeta validates only the scalar top-level fields of a
 * runtime File (name, path, info, start, code). The full schema clones its
 * input, which breaks the identity contract between `tasks` and the
 * `Task` objects held by `paths[*].tasks[*]` (see BUG-4). Use this when
 * you need a strict shape check without sacrificing object identity.
 */
export const schemaForLoadedFileMeta = z.object({
  name: z.string(),
  path: z.string(),
  info: z.string(),
  start: z.string(),
  code: z.object({ valid: z.boolean() }).nullable().optional(),
});

/**
 * schemaForPath is the Zod schema validating runtime loaded Path objects.
 */
export const schemaForPath: z.ZodType<Path, any, any> = z.lazy(() =>
  z.object({
    tasks: z.array(schemaForLoadedTask),
  }),
);

/**
 * schemaForLoadedProject is the Zod schema validating runtime loaded Project objects.
 */
export const schemaForLoadedProject: z.ZodType<Project, any, any> = z.lazy(() =>
  z.object({
    path: z.string(),
    variables: z.record(z.string(), z.string()),
    files: z.array(schemaForLoadedFile),
  }),
);
