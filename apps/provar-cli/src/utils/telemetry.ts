import pc from "picocolors";

export function renderTraceReport(trace: any) {
  if (!trace) return;

  const totalSandboxCount = trace.totalTimings["sandbox"]?.length || 0;
  const totalSandboxDurationMs =
    trace.totalTimings["sandbox"]?.reduce((a: number, b: number) => a + b, 0) ||
    0;
  const totalAgentCount = trace.totalTimings["agent"]?.length || 0;
  const totalAgentDurationMs =
    trace.totalTimings["agent"]?.reduce((a: number, b: number) => a + b, 0) ||
    0;

  console.log(
    pc.bold(pc.cyan(`\n🌌 Provar Telemetry - Performance Trace Report`)),
  );
  console.log(
    pc.dim(
      "-----------------------------------------------------------------------------------------",
    ),
  );
  console.log(`${pc.bold("Compile Target:")} ${pc.cyan(trace.target)}`);
  console.log(
    `${pc.bold("Total Duration:")} ${pc.yellow(trace.totalDurationMs.toFixed(2) + " ms")}`,
  );
  console.log(
    `${pc.bold("Agent Client Setup:")} ${pc.yellow(trace.setupDurationMs.toFixed(2) + " ms")}`,
  );
  console.log(
    `${pc.bold("Total Sandbox Runs:")} ${pc.yellow(totalSandboxCount)} (${totalSandboxDurationMs.toFixed(2)} ms total)`,
  );
  console.log(
    `${pc.bold("Total Agent Requests:")} ${pc.yellow(totalAgentCount)} (${totalAgentDurationMs.toFixed(2)} ms total)`,
  );
  console.log(
    pc.dim(
      "-----------------------------------------------------------------------------------------",
    ),
  );

  console.log(pc.bold("\nPhase Duration Breakdown:"));

  const total = trace.totalDurationMs || 1;
  const parsePct = ((trace.parseDurationMs / total) * 100).toFixed(1);
  const setupPct = ((trace.setupDurationMs / total) * 100).toFixed(1);
  const sandboxPct = ((totalSandboxDurationMs / total) * 100).toFixed(1);
  const agentPct = ((totalAgentDurationMs / total) * 100).toFixed(1);
  const writePct = ((trace.writeDurationMs / total) * 100).toFixed(1);
  const otherDuration = Math.max(
    0,
    total -
      (trace.parseDurationMs +
        trace.setupDurationMs +
        totalSandboxDurationMs +
        totalAgentDurationMs +
        trace.writeDurationMs),
  );
  const otherPct = ((otherDuration / total) * 100).toFixed(1);

  console.log(
    `  +-----------------------------------+-----------------------------------+`,
  );
  console.log(
    `  | ${pc.bold("Phase")}                             | ${pc.bold("Duration (ms)")}                       |`,
  );
  console.log(
    `  +-----------------------------------+-----------------------------------+`,
  );
  console.log(
    `  | Parsing & Resolving Paths         | ${trace.parseDurationMs.toFixed(1).padStart(12)} ms (${parsePct.padStart(5)}%)      |`,
  );
  console.log(
    `  | Agent Client Initialization       | ${trace.setupDurationMs.toFixed(1).padStart(12)} ms (${setupPct.padStart(5)}%)      |`,
  );
  console.log(
    `  | Playwright Sandbox Executions     | ${totalSandboxDurationMs.toFixed(1).padStart(12)} ms (${sandboxPct.padStart(5)}%)      |`,
  );
  console.log(
    `  | Agent Task Code Generation      | ${totalAgentDurationMs.toFixed(1).padStart(12)} ms (${agentPct.padStart(5)}%)      |`,
  );
  console.log(
    `  | File Serialization & Disk Writes  | ${trace.writeDurationMs.toFixed(1).padStart(12)} ms (${writePct.padStart(5)}%)      |`,
  );
  console.log(
    `  | Other Compiler Overhead           | ${otherDuration.toFixed(1).padStart(12)} ms (${otherPct.padStart(5)}%)      |`,
  );
  console.log(
    `  +-----------------------------------+-----------------------------------+`,
  );

  console.log(pc.bold("\nTask-by-Task Bottlenecks (Sorted by Duration):"));
  console.log(
    `  +----------------------+----------+---------------+------------+----------+-----------+`,
  );
  console.log(
    `  | ${pc.bold("Task ID")}               | ${pc.bold("Status")}   | ${pc.bold("Total Time")}    | ${pc.bold("Sandboxes")}  | ${pc.bold("Agent Req")} | ${pc.bold("Mode")}      |`,
  );
  console.log(
    `  +----------------------+----------+---------------+------------+----------+-----------+`,
  );

  const sortedTasks = [...(trace.tasks || [])].sort(
    (a, b) => b.durationMs - a.durationMs,
  );

  for (const task of sortedTasks) {
    const idStr = task.id.padEnd(20);

    let statusStr = task.status;
    if (task.status === "SUCCESS") statusStr = pc.green(task.status.padEnd(8));
    else if (task.status === "HEALED")
      statusStr = pc.yellow(task.status.padEnd(8));
    else if (task.status === "FAILED")
      statusStr = pc.red(task.status.padEnd(8));
    else statusStr = task.status.padEnd(8);

    const timeStr = (task.durationMs.toFixed(1) + " ms").padStart(13);

    const sandboxCount = task.timings["sandbox"]?.length || 0;
    const sandboxesStr = String(sandboxCount).padStart(10);

    const agentCount = task.timings["agent"]?.length || 0;
    const agentStr = String(agentCount).padStart(9);

    let modeColor = pc.cyan;
    if (task.mode === "SANDBOX") modeColor = pc.magenta;
    else if (task.mode === "FALLBACK") modeColor = pc.red;
    const modeStr = modeColor(task.mode.padEnd(9));

    console.log(
      `  | ${idStr} | ${statusStr} | ${timeStr} | ${sandboxesStr} | ${agentStr} | ${modeStr} |`,
    );
  }
  console.log(
    `  +----------------------+----------+---------------+------------+----------+-----------+`,
  );
}
