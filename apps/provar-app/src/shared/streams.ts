import { method } from "@thani-sh/steam-bun";
import { z } from "zod";

export const assistEditorStream = method("assistEditor", {
  input: z.object({
    prompt: z.string(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      )
      .optional(),
    path: z.string().optional(),
  }),
  output: z.object({
    text: z.string(),
    status: z.enum(["pending", "completed", "error"]),
  }),
});

export const compileTestStream = method("compileTest", {
  input: z.object({
    path: z.string(),
  }),
  output: z.object({
    yamlPath: z.string(),
    type: z.enum([
      "compile-started",
      "node-started",
      "node-succeeded",
      "node-failed",
      "compile-finished",
    ]),
    nodeId: z.string().optional(),
    title: z.string().optional(),
    error: z.string().optional(),
  }),
});

export const runTestPathStream = method("runTestPath", {
  input: z.object({
    path: z.string(),
    pathIndex: z.number(),
    upToTaskId: z.string().optional(),
    headless: z.boolean().optional(),
  }),
  output: z.object({
    runId: z.string(),
    type: z.enum([
      "run-started",
      "task-started",
      "task-finished",
      "task-failed",
      "visual-comparison-triggered",
      "run-finished",
    ]),
    taskId: z.string().optional(),
    title: z.string().optional(),
    error: z.string().optional(),
    screenshotBase64: z.string().optional(),
    visualCompare: z.boolean().optional(),
    status: z.string().optional(),
  }),
});
