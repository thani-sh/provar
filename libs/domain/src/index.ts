import { z } from "zod";

export const ConfigSchema = z.object({
  provider: z
    .object({
      type: z.string().optional(),
      name: z.string(),
      apiKey: z.string().optional(),
    })
    .passthrough(),
  variables: z.record(z.any()).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface GraphNode {
  title: string;
  info: string;
  next?: string | string[];
  visualCompare?: boolean;
  asserts?: Record<string, { title: string; info: string }>;
  graph?: {
    info: string;
    start: string;
    nodes: Record<string, GraphNode>;
  };
}

export const GraphNodeSchema: z.ZodType<GraphNode> = z.lazy(() =>
  z.object({
    title: z.string(),
    info: z.string(),
    next: z.union([z.string(), z.array(z.string())]).optional(),
    visualCompare: z.boolean().optional(),
    asserts: z
      .record(
        z.object({
          title: z.string(),
          info: z.string(),
        }),
      )
      .optional(),
    graph: z
      .object({
        info: z.string(),
        start: z.string(),
        nodes: z.record(GraphNodeSchema),
      })
      .optional(),
  }),
);

export const TestGraphSchema = z.object({
  name: z.string(),
  graph: z.object({
    info: z.string(),
    start: z.string(),
    nodes: z.record(GraphNodeSchema),
  }),
});

export type TestGraph = z.infer<typeof TestGraphSchema>;
