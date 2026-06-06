import { z } from "zod";
import type { Task, Graph, File, Path, Project } from "./index";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const PROVAR_DIR = ".provar";
export const TESTS_DIR = `${PROVAR_DIR}/tests`;
export const CONFIG_FILE = `${PROVAR_DIR}/config.yml`;

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------
const coerceStringToArray = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => (typeof val === "string" ? [val] : val));

// TaskConfig Schema (Shared)
export const schemaForTaskConfig = z.object({
  visualCompare: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Raw Serialized Schemas (Test YAML format on disk)
// ---------------------------------------------------------------------------

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

export type TestFileGraph = {
  info: string;
  start: string;
  nodes: Record<string, TestNode>;
};

export const schemaForGraph: z.ZodType<TestFileGraph, any, any> = z.lazy(() =>
  z.object({
    info: z.string(),
    start: z.string(),
    nodes: z.record(z.string().regex(/^task_[a-z0-9]{5}$/), schemaForTask),
  }),
);

export const schemaForFile = z.object({
  name: z.string(),
  graph: schemaForGraph,
});

export type TestFile = z.infer<typeof schemaForFile>;

// Provar Config Schema
export const configSchema = z.object({
  provider: z.discriminatedUnion("name", [
    z.object({
      name: z.literal("gemini-cli"),
      type: z.literal("local"),
    }),
    z.object({
      name: z.literal("copilot-cli"),
      type: z.literal("local"),
    }),
    z.object({
      name: z.literal("openai"),
      type: z.literal("remote"),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    }),
  ]),
  variables: z.record(z.string(), z.any()).optional(),
});

export type ProvarConfig = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Loaded Runtime Schemas (Memory representation used by Loader/Compiler)
// ---------------------------------------------------------------------------

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

export const schemaForLoadedGraph: z.ZodType<Graph, any, any> = z.lazy(
  () => baseLoadedGraphSchema,
);

export const schemaForLoadedFile: z.ZodType<File, any, any> = z.lazy(() =>
  baseLoadedGraphSchema.extend({
    name: z.string(),
    path: z.string(),
  }),
);

export const schemaForPath: z.ZodType<Path, any, any> = z.lazy(() =>
  z.object({
    tasks: z.array(schemaForLoadedTask),
  }),
);

export const schemaForLoadedProject: z.ZodType<Project, any, any> = z.lazy(() =>
  z.object({
    path: z.string(),
    variables: z.record(z.string(), z.string()),
    files: z.array(schemaForLoadedFile),
  }),
);
