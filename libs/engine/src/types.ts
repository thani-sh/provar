import { type Page } from "playwright";
import type { Path } from "@libs/domain";

/**
 * TestAPI defines the execution API exposed to the compiled test task functions.
 */
export interface TestAPI {
  page: Page;
  var: Record<string, unknown>;
  state: Record<string, unknown>;
  expect: unknown;
}

/**
 * GroundingContext contains HTML DOM state and screenshot details for grounding AI agent requests.
 */
export interface GroundingContext {
  pageContent?: string;
  screenshot?: string;
}

/**
 * RunnerState describes the current execution state of a test path run.
 */
export interface RunnerState {
  status: "idle" | "running" | "paused" | "success" | "failed" | "cancelled";
  current?: string;
  elapsed?: number;
  errors: Array<{ taskId: string; error: Error }>;
  pageContent?: string;
  pageScreenshot?: string;
  pageMutated?: boolean;
}

/**
 * RunnerEvent represents lifecycle events emitted by the runner during test execution.
 */
export type RunnerEvent =
  | { type: "run-started" }
  | { type: "task-started"; taskId: string; title: string }
  | { type: "task-finished"; taskId: string }
  | { type: "task-failed"; taskId: string; error: unknown }
  | {
      type: "visual-comparison-triggered";
      taskId: string;
      screenshotBase64: string;
      visualCompare?: boolean;
    }
  | { type: "run-finished"; status: RunnerState["status"] };

/**
 * RunnerResult contains the final execution result summary of a test path run.
 */
export interface RunnerResult extends RunnerState {
  status: "success" | "failed" | "cancelled";
}

/**
 * Runner is the interface implemented by test execution engines.
 */
export interface Runner {
  getState(): RunnerState;
  events(): AsyncGenerator<RunnerEvent, void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  wait(): Promise<RunnerResult>;
}

/**
 * ExecuteOptions contains configuration parameter overrides for executing a test run.
 */
export interface ExecuteOptions {
  headless?: boolean;
  variables?: Record<string, unknown>;
  upToTaskId?: string;
  existingPage?: Page;
  provarPath?: string;
}
