import { z } from "zod";

export const taskConfigSchema = z.object({
  visualCompare: z.boolean().optional(),
});

export type TaskConfig = z.infer<typeof taskConfigSchema>;

/**
 * Type definition for a test node.
 */
export type TestNode = {
  title: string;
  info: string;
  next?: string | string[];
  config?: TaskConfig;
  graph?: Graph;
  // Augmented properties for the editor
  hasGeneratedCode?: boolean;
  isUpToDate?: boolean;
  screenshotUrl?: string;
};

/**
 * Schema for an action node.
 */
export const testNodeSchema: z.ZodType<TestNode> = z.lazy(() =>
  z.object({
    title: z.string(),
    info: z.string(),
    next: z.union([z.string(), z.array(z.string())]).optional(),
    config: taskConfigSchema.optional(),
    graph: graphSchema.optional(),
  }),
);

export const testNodeIdSchema = z.string().regex(/^action_[a-z0-9]{5}$/);

/**
 * Type definition for a test graph.
 */
export type Graph = {
  info: string;
  start: string;
  nodes: Record<string, TestNode>;
};

/**
 * Schema for a complete test graph.
 */
export const graphSchema: z.ZodType<Graph> = z.lazy(() =>
  z.object({
    info: z.string(),
    start: z.string(),
    nodes: z.record(testNodeIdSchema, testNodeSchema),
  }),
);

/**
 * Root test file schema.
 */
export const testFileSchema = z.object({
  name: z.string(),
  graph: graphSchema,
});

export type TestFile = z.infer<typeof testFileSchema>;

// ---------------------------------------------------------------------------
// Filesystem Conventions
// ---------------------------------------------------------------------------

export const PROVAR_DIR = ".provar";
export const TESTS_DIR = `${PROVAR_DIR}/tests`;
export const CONFIG_FILE = `${PROVAR_DIR}/config.yml`;

/**
 * Schema for the project configuration.
 */
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
  variables: z.record(z.any()).optional(),
});

export type ProvarConfig = z.infer<typeof configSchema>;
