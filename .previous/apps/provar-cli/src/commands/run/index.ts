import * as fs from "fs";
import * as path from "path";
import pc from "picocolors";
import { execute, loadProject, type Runner } from "@libs/engine";
import { findFilesByExtension } from "../../utils/fs";
import { isCancelled, onCancel } from "../../utils/signal";
import { ExitCode } from "../../utils/exit-codes";

/**
 * handleRun implements `provar run <target> [--up-to <taskId>] [--headless <bool>]`. Iterates
 * the resolved `.test.ts` files, executes each path through the engine, and prints events as
 * they stream. Honours SIGINT/SIGTERM via the shared signal util: between files we check
 * `isCancelled()`, and on the first signal we cancel every in-flight `Runner` and await their
 * `wait()` promises so the engine's `finally` block in `libs/engine/src/test-run.ts` can
 * close the Playwright browser cleanly.
 *
 * Exit codes follow the convention: 0 = success, 1 = runtime error, 2 = usage error,
 * 130 = SIGINT.
 */
export async function handleRun(args: string[]): Promise<void> {
  const targetArg = args[1];
  if (!targetArg) {
    console.error(pc.red("❌ Error: Missing test path (file or directory)"));
    process.exit(ExitCode.UsageError);
  }

  const resolvedPath = path.resolve(process.cwd(), targetArg);
  if (!fs.existsSync(resolvedPath)) {
    console.error(pc.red(`❌ Error: Target path not found: ${resolvedPath}`));
    process.exit(ExitCode.UsageError);
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
      process.exit(ExitCode.UsageError);
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

  // Track every Runner we spin up so the SIGINT handler can cancel them
  // all and await their `wait()` promise. Without this, the test-run
  // `finally` block wouldn't run on Ctrl-C and the Playwright browser
  // would leak.
  const activeRunners = new Set<Runner>();
  onCancel(async () => {
    // Cancel all in-flight runners in parallel. `cancel()` is idempotent
    // and signals the underlying step's AbortSignal, so an in-flight
    // task aborts mid-execute rather than completing.
    await Promise.all(
      [...activeRunners].map((runner) =>
        runner.cancel().catch(() => {
          // A runner that already finished has no `cancel()` to honour —
          // swallow.
        }),
      ),
    );
    // Then wait for every run to settle so the engine's `finally` block
    // (close browser, write trace, resolve waitPromise) gets a chance to
    // run before the process exits.
    await Promise.all(
      [...activeRunners].map((runner) =>
        runner.wait().catch(() => {
          // Same — already settled is fine.
        }),
      ),
    );
  });

  for (const testFilePath of filesToRun) {
    if (isCancelled()) {
      break;
    }
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
      console.log(pc.dim(`  ⚙ Loaded Variables: ${JSON.stringify(variables)}`));
    }

    let suiteSuccess = true;
    for (const resolvedPath of execFile.paths) {
      if (isCancelled()) {
        break;
      }
      const runner: Runner = await execute(resolvedPath, {
        upToTaskId,
        headless,
        variables,
        provarPath: project.path,
      });
      activeRunners.add(runner);

      let runnerSettled = false;
      try {
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
            case "task-failed": {
              const errMsg =
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error);
              console.log(
                `    ${pc.red("✖")} ${pc.red("Failed:")} ${pc.bold(errMsg)}`,
              );
              break;
            }
            case "run-finished":
              if (event.status === "failed") {
                suiteSuccess = false;
                runSuccess = false;
              }
              if (event.status === "cancelled") {
                // A `run-finished` with status `cancelled` is the engine's
                // own signal that we asked for cancellation — propagate
                // it so the outer `isCancelled()` check picks it up.
                suiteSuccess = false;
              }
              const color = event.status === "success" ? pc.green : pc.red;
              if (event.status === "success" || event.status === "failed") {
                console.log(
                  `  🏁 Path Finished: ${color(event.status.toUpperCase())}`,
                );
              } else if (event.status === "cancelled") {
                console.log(
                  `  ${pc.yellow("⏹")} Path ${pc.yellow("CANCELLED")}`,
                );
              }
              break;
          }
        }
      } finally {
        // Either the loop drained or the consumer broke out — either way,
        // make sure we have the runner's final result so the waitPromise
        // resolves before we drop the reference.
        if (!runnerSettled) {
          await runner
            .wait()
            .catch(() => {
              // waitPromise may have already settled during the loop.
            })
            .finally(() => {
              runnerSettled = true;
            });
        }
        activeRunners.delete(runner);
      }
    }

    if (suiteSuccess) {
      successCount++;
    }
  }

  if (isCancelled()) {
    console.log(
      pc.yellow(
        `\n⏹  Execution cancelled. ${successCount} of ${filesToRun.length} suite(s) completed before the signal.`,
      ),
    );
    process.exit(ExitCode.SigInt);
  }

  const finalColor = runSuccess ? pc.green : pc.red;
  console.log(
    pc.bold(
      `\n🎉 Execution Finished! Successfully executed [${successCount}/${filesToRun.length}] suites. [Result: ${finalColor(runSuccess ? "SUCCESS" : "FAILED")}]`,
    ),
  );

  if (!runSuccess) {
    process.exit(ExitCode.RuntimeError);
  }
  process.exit(ExitCode.Success);
}
