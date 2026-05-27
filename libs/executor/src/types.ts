import { type Page } from "playwright";
import type { Path } from "@libs/domain";

export interface TestAPI {
  page: Page;
  var: Record<string, any>;
  state: Record<string, any>;
  expect: any;
}

export interface GroundingContext {
  pageContent?: string;
  screenshot?: string;
}

export interface RunnerState {
  status: "idle" | "running" | "paused" | "success" | "failed" | "cancelled";
  current?: string;
  elapsed?: number;
  errors: Array<{ taskId: string; error: Error }>;
  pageContent?: string;
  pageScreenshot?: string;
  pageMutated?: boolean;
}

export type RunnerEvent =
  | { type: "run-started" }
  | { type: "task-started"; taskId: string; title: string }
  | { type: "task-finished"; taskId: string }
  | { type: "task-failed"; taskId: string; error: any }
  | {
      type: "visual-comparison-triggered";
      taskId: string;
      screenshotBase64: string;
      visualCompare?: boolean;
    }
  | { type: "run-finished"; status: RunnerState["status"] };

export interface RunnerResult extends RunnerState {
  status: "success" | "failed" | "cancelled";
}

export interface Runner {
  getState(): RunnerState;
  events(): AsyncGenerator<RunnerEvent, void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  wait(): Promise<RunnerResult>;
}

export interface ExecuteOptions {
  headless?: boolean;
  variables?: Record<string, any>;
  upToActionId?: string;
  existingPage?: Page;
}


