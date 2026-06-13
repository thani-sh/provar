import { describe, expect, test } from "bun:test";
import { CompilerPerformanceTracker } from "../compiler/tracker";
import { cleanCode } from "../compiler/generator";

describe("cleanCode", () => {
  test("strips a leading ```ts / ```javascript fenced block", () => {
    const input = "```ts\nawait page.click('a');\n```";
    expect(cleanCode(input)).toBe("await page.click('a');");
  });

  test("strips a fenced block with no language tag", () => {
    const input = "```\nconst x = 1;\n```";
    expect(cleanCode(input)).toBe("const x = 1;");
  });

  test("trims surrounding whitespace", () => {
    expect(cleanCode("  \n  const x = 1;  \n")).toBe("const x = 1;");
  });

  test("leaves plain code unchanged", () => {
    const input = "await page.fill('input', 'a');";
    expect(cleanCode(input)).toBe(input);
  });
});

describe("CompilerPerformanceTracker", () => {
  test("initialises an empty trace shape", () => {
    const t = new CompilerPerformanceTracker("foo.test.yml");
    const trace = t.getTrace();
    expect(trace.target).toBe("foo.test.yml");
    expect(trace.tasks).toEqual([]);
    expect(trace.totalTimings).toEqual({});
    // totalDurationMs is only meaningful after start()/end() are called;
    // verify the other zero-valued fields are zero instead.
    expect(trace.setupDurationMs).toBe(0);
    expect(trace.parseDurationMs).toBe(0);
    expect(trace.writeDurationMs).toBe(0);
  });

  test("initTask seeds a SUCCESS entry with the given mode", () => {
    const t = new CompilerPerformanceTracker("foo");
    t.initTask("task_aaaaa", "Open page", "STATEFUL");
    const [task] = t.getTrace().tasks;
    expect(task).toBeDefined();
    expect(task).toMatchObject({
      id: "task_aaaaa",
      title: "Open page",
      status: "SUCCESS",
      mode: "STATEFUL",
      durationMs: 0,
      retryCount: 0,
    });
  });

  test("setTaskStatus / setTaskMode mutate the existing entry", () => {
    const t = new CompilerPerformanceTracker("foo");
    t.initTask("task_aaaaa", "A");
    t.setTaskStatus("task_aaaaa", "HEALED");
    t.setTaskMode("task_aaaaa", "FALLBACK");
    const [task] = t.getTrace().tasks;
    expect(task).toBeDefined();
    expect(task!.status).toBe("HEALED");
    expect(task!.mode).toBe("FALLBACK");
  });

  test("recordTaskTiming appends to both task and total buckets", () => {
    const t = new CompilerPerformanceTracker("foo");
    t.initTask("task_aaaaa", "A");
    t.recordTaskTiming("task_aaaaa", "sandbox", 12.5);
    t.recordTaskTiming("task_aaaaa", "sandbox", 7.5);
    const [task] = t.getTrace().tasks;
    expect(task).toBeDefined();
    expect(task!.timings["sandbox"]).toEqual([12.5, 7.5]);
    expect(t.getTrace().totalTimings["sandbox"]).toEqual([12.5, 7.5]);
  });

  test("recordTaskTiming on an unknown id is a no-op", () => {
    const t = new CompilerPerformanceTracker("foo");
    // Should not throw.
    t.recordTaskTiming("nope", "sandbox", 1);
    expect(t.getTrace().tasks).toEqual([]);
  });

  test("recordTaskRetry increments the per-task retry counter", () => {
    const t = new CompilerPerformanceTracker("foo");
    t.initTask("task_aaaaa", "A");
    t.recordTaskRetry("task_aaaaa");
    t.recordTaskRetry("task_aaaaa");
    t.recordTaskRetry("task_aaaaa");
    const task = t.getTrace().tasks[0];
    expect(task).toBeDefined();
    expect(task!.retryCount).toBe(3);
  });

  test("endTaskTimer accumulates elapsed ms onto the task duration", () => {
    const t = new CompilerPerformanceTracker("foo");
    t.initTask("task_aaaaa", "A");
    const start = t.startTaskTimer("task_aaaaa");
    // Simulate a 5ms-ish chunk by sleeping a hair.
    const busy = (): number => {
      const s = performance.now();
      // Burn a tiny amount of CPU; not testing precision, just accumulation.
      while (performance.now() - s < 1) {
        /* spin */
      }
      return performance.now();
    };
    t.endTaskTimer("task_aaaaa", start);
    t.endTaskTimer("task_aaaaa", busy());
    const task = t.getTrace().tasks[0];
    expect(task).toBeDefined();
    expect(task!.durationMs).toBeGreaterThan(0);
  });

  test("end() enables totalDurationMs reporting", () => {
    const t = new CompilerPerformanceTracker("foo");
    t.start();
    // Burn at least one ms.
    const s = performance.now();
    while (performance.now() - s < 1) {
      /* spin */
    }
    t.end();
    expect(t.getTrace().totalDurationMs).toBeGreaterThan(0);
  });
});
