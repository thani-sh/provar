import { z } from "zod";
import type { Task, Graph, File, Path, Project } from "./index";

const coerceStringToArray = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => (typeof val === "string" ? [val] : val));

// 1. Task Schema
export const schemaForTask: z.ZodType<Task, z.ZodTypeDef, any> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    info: z.string(),
    next: coerceStringToArray,
    code: z.string().optional(),
    graph: z.lazy(() => schemaForGraph).optional(),
  }),
);

// Base Graph Object Schema to allow extension
const baseGraphSchema = z.object({
  info: z.string(),
  start: z.string(),
  tasks: z.record(z.string(), schemaForTask),
  paths: z.array(z.lazy(() => schemaForPath)),
});

// 2. Graph Schema
export const schemaForGraph: z.ZodType<Graph, z.ZodTypeDef, any> = z.lazy(
  () => baseGraphSchema,
);

// 3. File Schema (Extends Graph)
export const schemaForFile: z.ZodType<File, z.ZodTypeDef, any> = z.lazy(() =>
  baseGraphSchema.extend({
    name: z.string(),
    path: z.string(),
  }),
);

// 4. Path Schema
export const schemaForPath: z.ZodType<Path, z.ZodTypeDef, any> = z.lazy(() =>
  z.object({
    tasks: z.array(schemaForTask),
  }),
);

// 5. Project Schema
export const schemaForProject: z.ZodType<Project, z.ZodTypeDef, any> = z.lazy(
  () =>
    z.object({
      path: z.string(),
      variables: z.record(z.string(), z.string()),
      files: z.array(schemaForFile),
    }),
);
