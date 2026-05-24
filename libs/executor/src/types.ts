import { type Page } from "playwright";

export interface TestAPI {
  page: Page;
  var: Record<string, any>;
  state: Record<string, any>;
}

export interface GroundingContext {
  pageContent?: string;
  screenshot?: string;
}

export interface Action {
  (api: TestAPI): Promise<void>;
  id: string;
  title: string;
}

export interface TestDefinition {
  name: string;
  actions: Action[];
}

export interface TestRunState {
  status: "idle" | "running" | "success" | "failed";
  currentTestName?: string;
  currentActionId?: string;
  errors: Array<{ testName: string; actionId?: string; error: Error }>;
}

export type TestRunEvent =
  | { type: "run-started" }
  | { type: "test-started"; testName: string }
  | {
      type: "action-started";
      testName: string;
      actionId: string;
      actionTitle: string;
    }
  | { type: "action-finished"; testName: string; actionId: string }
  | { type: "action-failed"; testName: string; actionId: string; error: any }
  | {
      type: "test-finished";
      testName: string;
      status: "success" | "failed";
      error?: any;
    }
  | { type: "run-finished"; status: "success" | "failed" };

export interface RunTestOptions {
  testFilePath: string;
  testName?: string;
  upToActionId?: string;
  headless?: boolean;
  variables?: Record<string, any>;
}
