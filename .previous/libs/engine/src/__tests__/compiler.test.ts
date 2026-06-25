import { describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  assertNotAborted,
  CompileAbortedError,
  compileProgress,
} from "../compiler/compiler";

/**
 * A minimal valid two-node graph. Small enough that parsing succeeds instantly, and the
 * YAML shape is identical to what the real CLI passes in.
 */
const MINIMAL_YAML = `
name: abort-target
graph:
  info: ""
  start: task_aaaaa
  nodes:
    task_aaaaa:
      title: First step
      info: ""
      next: task_bbbbb
    task_bbbbb:
      title: Second step
      info: ""
`;

const writeYaml = (dir: string, body: string): string => {
  const filePath = path.join(dir, "abort-target.test.yml");
  fs.writeFileSync(filePath, body);
  return filePath;
};

describe("CompileAbortedError", () => {
  test("is an Error subclass with the expected name", () => {
    const err = new CompileAbortedError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CompileAbortedError);
    expect(err.name).toBe("CompileAbortedError");
    expect(err.message).toMatch(/cancel/i);
  });
});

describe("assertNotAborted", () => {
  test("does not throw when no signal is provided", () => {
    expect(() => assertNotAborted()).not.toThrow();
    expect(() => assertNotAborted(undefined)).not.toThrow();
  });

  test("does not throw when the signal is not yet aborted", () => {
    const controller = new AbortController();
    expect(() => assertNotAborted(controller.signal)).not.toThrow();
  });

  test("throws CompileAbortedError when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => assertNotAborted(controller.signal)).toThrow(
      CompileAbortedError,
    );
  });
});

describe("compileProgress abort handling", () => {
  let tmpDir: string;

  const setup = (): string => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "provar-compile-abort-"));
    return writeYaml(tmpDir, MINIMAL_YAML);
  };

  test("aborts before any LLM client setup when the signal is pre-aborted", async () => {
    const yamlPath = setup();
    const controller = new AbortController();
    controller.abort();

    // Use a deliberately invalid agentConfig so that, if the abort check
    // were missing, `createClient` would throw a different error and the
    // test would fail with the wrong error type.
    const events: Array<{ type: string; success?: boolean }> = [];
    let thrown: unknown = null;
    try {
      for await (const event of compileProgress({
        yamlPath,
        agentConfig: {
          // The schema accepts any string for provider here — the abort
          // path must fire before createClient is ever reached.
          provider: "openai" as never,
          apiKey: "",
          model: "gpt-4",
        },
        signal: controller.signal,
      })) {
        events.push({
          type: event.type,
          success: "success" in event ? event.success : undefined,
        });
      }
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(CompileAbortedError);
    // The only events we should see are the bookends: a started, then a
    // finished with success: false. Anything else means the abort didn't
    // fire before the parser/client setup.
    expect(events.map((e) => e.type)).toEqual([
      "compile-started",
      "compile-finished",
    ]);
    const finished = events.find((e) => e.type === "compile-finished");
    expect(finished?.success).toBe(false);
  });

  test("aborts before any work when a pre-aborted signal is passed (compile wrapper)", async () => {
    // The `compile()` wrapper re-throws whatever `compileProgress` throws,
    // so this also confirms the wrapper does not swallow the abort error.
    // We use a pre-aborted signal to keep the test free of LLM / API key
    // requirements — the abort check fires before any client setup.
    const yamlPath = setup();
    const controller = new AbortController();
    controller.abort();

    const { compile } = await import("../compiler/compiler");
    let thrown: unknown = null;
    try {
      await compile({
        yamlPath,
        agentConfig: {
          provider: "openai" as never,
          apiKey: "",
          model: "gpt-4",
        },
        signal: controller.signal,
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(CompileAbortedError);
  });

  test("does not throw when no signal is provided", async () => {
    // Sanity check: the signal is optional, so the absence of it must
    // not regress the existing path. This test will fail at createClient
    // (we pass an empty api key), so we only assert that the error is
    // NOT a CompileAbortedError.
    const yamlPath = setup();
    let thrown: unknown = null;
    try {
      for await (const _event of compileProgress({
        yamlPath,
        agentConfig: {
          provider: "openai" as never,
          apiKey: "",
          model: "gpt-4",
        },
      })) {
        // drain
      }
    } catch (err) {
      thrown = err;
    }

    expect(thrown).not.toBeInstanceOf(CompileAbortedError);
    // We expect either a runtime error from createClient, or — if the
    // provider config layer happens to accept an empty key — a successful
    // completion. Either is fine; the contract is "not an abort error".
  });
});
