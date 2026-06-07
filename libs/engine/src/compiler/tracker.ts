/**
 * TaskTelemetry captures execution metrics and performance details for a single task compilation.
 */
export interface TaskTelemetry {
  id: string;
  title: string;
  status: "SUCCESS" | "HEALED" | "FAILED" | "SKIPPED";
  mode: "STATEFUL" | "SANDBOX" | "FALLBACK";
  durationMs: number;
  timings: Record<string, number[]>;
  retryCount: number;
}

/**
 * CompilationTrace represents the full performance compilation report of a test suite run.
 */
export interface CompilationTrace {
  target: string;
  totalDurationMs: number;
  setupDurationMs: number;
  parseDurationMs: number;
  writeDurationMs: number;
  totalTimings: Record<string, number[]>;
  tasks: TaskTelemetry[];
}

/**
 * CompilerPerformanceTracker monitors parsing, network calls, sandbox test executions, and disk writes timings.
 */
export class CompilerPerformanceTracker {
  private startTime = 0;
  private endTime = 0;
  private setupStartTime = 0;
  private setupEndTime = 0;
  private parseStartTime = 0;
  private parseEndTime = 0;
  private writeStartTime = 0;
  private writeEndTime = 0;

  private totalTimings: Record<string, number[]> = {};
  private tasks = new Map<string, TaskTelemetry>();

  constructor(private target: string) {}

  start() {
    this.startTime = performance.now();
  }

  end() {
    this.endTime = performance.now();
  }

  startSetup() {
    this.setupStartTime = performance.now();
  }

  endSetup() {
    this.setupEndTime = performance.now();
  }

  startParse() {
    this.parseStartTime = performance.now();
  }

  endParse() {
    this.parseEndTime = performance.now();
  }

  startWrite() {
    this.writeStartTime = performance.now();
  }

  endWrite() {
    this.writeEndTime = performance.now();
  }

  recordTiming(key: string, durationMs: number) {
    if (!this.totalTimings[key]) {
      this.totalTimings[key] = [];
    }
    this.totalTimings[key].push(durationMs);
  }

  initTask(
    id: string,
    title: string,
    mode: TaskTelemetry["mode"] = "STATEFUL",
  ) {
    this.tasks.set(id, {
      id,
      title,
      status: "SUCCESS",
      mode,
      durationMs: 0,
      timings: {},
      retryCount: 0,
    });
  }

  startTaskTimer(id: string): number {
    return performance.now();
  }

  endTaskTimer(id: string, startTime: number) {
    const task = this.tasks.get(id);
    if (task) {
      task.durationMs += performance.now() - startTime;
    }
  }

  recordTaskTiming(id: string, key: string, durationMs: number) {
    const task = this.tasks.get(id);
    if (task) {
      if (!task.timings[key]) {
        task.timings[key] = [];
      }
      task.timings[key].push(durationMs);
      this.recordTiming(key, durationMs);
    }
  }

  recordTaskRetry(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.retryCount++;
    }
  }

  setTaskStatus(id: string, status: TaskTelemetry["status"]) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
    }
  }

  setTaskMode(id: string, mode: TaskTelemetry["mode"]) {
    const task = this.tasks.get(id);
    if (task) {
      task.mode = mode;
    }
  }

  getTrace(): CompilationTrace {
    const totalDurationMs = this.endTime
      ? this.endTime - this.startTime
      : performance.now() - this.startTime;
    const setupDurationMs = this.setupEndTime
      ? this.setupEndTime - this.setupStartTime
      : 0;
    const parseDurationMs = this.parseEndTime
      ? this.parseEndTime - this.parseStartTime
      : 0;
    const writeDurationMs = this.writeEndTime
      ? this.writeEndTime - this.writeStartTime
      : 0;

    return {
      target: this.target,
      totalDurationMs,
      setupDurationMs,
      parseDurationMs,
      writeDurationMs,
      totalTimings: this.totalTimings,
      tasks: Array.from(this.tasks.values()),
    };
  }
}
