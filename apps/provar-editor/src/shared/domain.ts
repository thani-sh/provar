import { z } from "zod";

/**
 * Schema for an assertion node.
 */
export const assertionSchema = z.object({
  title: z.string(),
  info: z.string(),
});

export type Assertion = z.infer<typeof assertionSchema>;

export const assertionIdSchema = z
  .string()
  .regex(/^assert_[a-z0-9]{5}$/);

/**
 * Type definition for a test node.
 */
export type TestNode = {
  title: string;
  info: string;
  next?: string | string[];
  asserts?: Record<string, Assertion>;
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
    asserts: z.record(assertionIdSchema, assertionSchema).optional(),
    graph: graphSchema.optional(),
  })
);

export const testNodeIdSchema = z
  .string()
  .regex(/^action_[a-z0-9]{5}$/);

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
  })
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
export const NODES_DIR = `${PROVAR_DIR}/nodes`;
export const SUITES_DIR = `${PROVAR_DIR}/suites`;
export const CONFIG_FILE = `${PROVAR_DIR}/config.yml`;

/**
 * Schema for the project configuration.
 */
export const configSchema = z.object({
  provider: z.object({
    type: z.enum(["local", "remote"]),
    name: z.string(),
  }),
  variables: z.record(z.any()).optional(),
});

export type ProvarConfig = z.infer<typeof configSchema>;
