import { execute, compile, loadProject } from "@libs/engine";
import pc from "picocolors";
import * as path from "path";
import * as fs from "fs";
import { loadSettings } from "@libs/config";

// Recursively find all files of a specific extension
function findFilesByExtension(targetPath: string, extension: string): string[] {
  const fileList: string[] = [];

  function scan(current: string) {
    if (!fs.existsSync(current)) return;
    const stat = fs.statSync(current);

    if (stat.isDirectory()) {
      const children = fs.readdirSync(current);
      for (const child of children) {
        scan(path.join(current, child));
      }
    } else if (stat.isFile() && current.endsWith(extension)) {
      fileList.push(current);
    }
  }

  scan(targetPath);
  return fileList;
}

function renderTraceReport(trace: any) {
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

async function main() {
  const args = Bun.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(
      pc.bold(pc.cyan("🌌 Provar CLI - AI-driven End-to-End Test Engine")),
    );
    console.log("\nUsage:");
    console.log(
      "  provar run <test-file-path|dir> [options]  Run a single TS test file or a whole directory",
    );
    console.log(
      "  provar compile <test-file-path|dir> [--trace] Compile a single file or directory, with performance trace",
    );
    console.log("\nOptions:");
    console.log(
      "  --up-to <taskId>                         Execute the test only up to this task ID",
    );
    console.log(
      "  --headless <true|false>                    Launch browser in headless mode (default: true)",
    );
    return;
  }

  if (command === "compile") {
    const targetArg = args[1];
    if (!targetArg) {
      console.error(pc.red("❌ Error: Missing test path (file or directory)"));
      process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), targetArg);
    if (!fs.existsSync(resolvedPath)) {
      console.error(pc.red(`❌ Error: Target path not found: ${resolvedPath}`));
      process.exit(1);
    }

    // Parse options
    let traceEnabled = false;
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--trace") {
        traceEnabled = true;
      }
    }

    const stat = fs.statSync(resolvedPath);
    let filesToCompile: string[] = [];

    if (stat.isFile()) {
      if (!resolvedPath.endsWith(".test.yml")) {
        console.error(
          pc.red("❌ Error: Single compile targets must be .test.yml files"),
        );
        process.exit(1);
      }
      filesToCompile.push(resolvedPath);
    } else if (stat.isDirectory()) {
      try {
        const project = await loadProject(resolvedPath);
        filesToCompile = project.files.map((f) => f.path);
      } catch (err: any) {
        console.error(pc.red(`❌ Error loading project: ${err.message}`));
        process.exit(1);
      }
      if (filesToCompile.length === 0) {
        console.log(
          pc.yellow(`⚠️  No .test.yml files found in: ${resolvedPath}`),
        );
        return;
      }
    }

    console.log(
      pc.blue(
        `\n⚡ Commencing Provar Compile on ${pc.bold(filesToCompile.length)} targets...`,
      ),
    );
    let successCount = 0;

    const settings = loadSettings();
    const provider = settings.models.defaultProvider;
    const cfg = settings.models.providers[provider];
    const agentConfig = {
      provider,
      apiKey: cfg.apiKey,
      model: cfg.model,
      baseUrl: (cfg as any).baseUrl,
    };

    for (const yamlPath of filesToCompile) {
      console.log(`\n⚙ Compiling: ${pc.cyan(yamlPath)}`);
      try {
        const result = await compile({ yamlPath, agentConfig });

        console.log(
          `  ${pc.green("✔")} Compiled to: ${pc.bold(result.outputPath)} (${pc.dim(result.pathsResolved + " paths")})`,
        );
        successCount++;

        if (traceEnabled && result.trace) {
          renderTraceReport(result.trace);
        }
      } catch (err: any) {
        console.error(
          `  ${pc.red("✖")} Compilation Failed: ${pc.red(err.message)}`,
        );
      }
    }

    console.log(
      pc.bold(
        pc.green(
          `\n🎉 Compilation finished! Successfully compiled [${successCount}/${filesToCompile.length}] targets.`,
        ),
      ),
    );
    if (successCount < filesToCompile.length) {
      process.exit(1);
    }
    process.exit(0);
  }

  if (command === "run") {
    const targetArg = args[1];
    if (!targetArg) {
      console.error(pc.red("❌ Error: Missing test path (file or directory)"));
      process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), targetArg);
    if (!fs.existsSync(resolvedPath)) {
      console.error(pc.red(`❌ Error: Target path not found: ${resolvedPath}`));
      process.exit(1);
    }

    // Process additional options
    let upToTaskId: string | undefined;
    let headless = true;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--up-to") {
        upToTaskId = args[i + 1];
        i++;
      } else if (args[i] === "--headless") {
        headless = args[i + 1] !== "false";
        i++;
      }
    }

    const stat = fs.statSync(resolvedPath);
    let filesToRun: string[] = [];

    if (stat.isFile()) {
      if (!resolvedPath.endsWith(".test.ts")) {
        console.error(
          pc.red(
            "❌ Error: Single execution targets must be compiled .test.ts files",
          ),
        );
        process.exit(1);
      }
      filesToRun.push(resolvedPath);
    } else if (stat.isDirectory()) {
      filesToRun = findFilesByExtension(resolvedPath, ".test.ts");
      if (filesToRun.length === 0) {
        console.log(
          pc.yellow(`⚠️  No compiled .test.ts files found in: ${resolvedPath}`),
        );
        return;
      }
    }

    console.log(
      pc.blue(
        `\n🚀 Commencing Provar Execution on ${pc.bold(filesToRun.length)} suites...`,
      ),
    );
    let runSuccess = true;
    let successCount = 0;

    for (const testFilePath of filesToRun) {
      console.log(pc.cyan(`\n📦 Executing Suite: ${pc.bold(testFilePath)}`));

      let variables = {};
      let execFile;
      let project;
      try {
        const yamlPath = testFilePath.replace(".test.ts", ".test.yml");
        project = await loadProject(yamlPath);
        variables = project.variables || {};
        execFile = await project.readFile(yamlPath);
      } catch (err: any) {
        console.error(pc.red(`  ❌ Failed to load test suite: ${err.message}`));
        runSuccess = false;
        continue;
      }

      if (!execFile.code) {
        console.error(
          pc.red(
            `  ❌ Compiled TypeScript file not found. Run 'provar compile' first.`,
          ),
        );
        runSuccess = false;
        continue;
      }

      if (!execFile.code.valid) {
        console.warn(
          pc.yellow(
            `  ⚠️  Test file has changed since last compilation. Consider re-running 'provar compile'.`,
          ),
        );
      }

      if (Object.keys(variables).length > 0) {
        console.log(
          pc.dim(`  ⚙ Loaded Variables: ${JSON.stringify(variables)}`),
        );
      }

      let suiteSuccess = true;
      for (const resolvedPath of execFile.paths) {
        const runner = await execute(resolvedPath, {
          upToTaskId,
          headless,
          variables,
          provarPath: project.path,
        });

        for await (const event of runner.events()) {
          switch (event.type) {
            case "run-started":
              console.log(pc.yellow("  • Test run initialized..."));
              break;
            case "task-started":
              console.log(
                `    ${pc.cyan("⏳")} ${event.title} (${pc.dim(event.taskId)})...`,
              );
              break;
            case "task-finished":
              console.log(`    ${pc.green("✔")} ${pc.green("Completed")}`);
              break;
            case "task-failed":
              console.log(
                `    ${pc.red("✖")} ${pc.red("Failed:")} ${pc.bold(event.error.message || event.error)}`,
              );
              break;
            case "run-finished":
              if (event.status === "failed") {
                suiteSuccess = false;
                runSuccess = false;
              }
              const color = event.status === "success" ? pc.green : pc.red;
              if (event.status === "success" || event.status === "failed") {
                console.log(
                  `  🏁 Path Finished: ${color(event.status.toUpperCase())}`,
                );
              }
              break;
          }
        }
      }

      if (suiteSuccess) {
        successCount++;
      }
    }

    const finalColor = runSuccess ? pc.green : pc.red;
    console.log(
      pc.bold(
        `\n🎉 Execution Finished! Successfully executed [${successCount}/${filesToRun.length}] suites. [Result: ${finalColor(runSuccess ? "SUCCESS" : "FAILED")}]`,
      ),
    );

    if (!runSuccess) {
      process.exit(1);
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(pc.red(`Fatal CLI Error: ${err.message}`));
  process.exit(1);
});
