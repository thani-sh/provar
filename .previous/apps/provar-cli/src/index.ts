import pc from "picocolors";
import { handleCompile } from "./commands/compile";
import { handleRun } from "./commands/run";
import { handleInit } from "./commands/init";
import {
  registerSignalHandlers,
  runCancelCleanups,
  isCancelled,
} from "./utils/signal";
import { ExitCode } from "./utils/exit-codes";

async function main() {
  // Install the SIGINT/SIGTERM handlers as early as possible. The first
  // signal flips a shared `cancelled` flag (which the per-command
  // handlers check between iterations) and triggers every registered
  // cleanup. The second signal is a force-exit — the user has decided
  // the cleanup is taking too long.
  registerSignalHandlers({
    onCancel: async () => {
      // Run every cleanup registered via onCancel(fn) in the handlers.
      // The handlers themselves are responsible for the in-flight
      // cancel; we just coordinate the wait-and-exit here.
      await runCancelCleanups();
      if (isCancelled()) {
        process.exit(ExitCode.SigInt);
      }
    },
    onSecondSignal: () => process.exit(ExitCode.SigInt),
  });

  const args = Bun.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(
      pc.bold(pc.cyan("🌌 Provar CLI - AI-driven End-to-End Test Engine")),
    );
    console.log("\nUsage:");
    console.log(
      "  provar init <name> [--sample]              Create a new Provar project (use --sample for the bundled starter)",
    );
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

  if (command === "init") {
    await handleInit(args.slice(1));
    return;
  }

  if (command === "compile") {
    await handleCompile(args);
    return;
  }

  if (command === "run") {
    await handleRun(args);
    return;
  }

  console.error(
    pc.red(
      `Unknown command: ${command}\nRun 'provar --help' to see the list of commands.`,
    ),
  );
  process.exit(ExitCode.UsageError);
}

main().catch((err) => {
  console.error(pc.red(`Fatal CLI Error: ${err.message}`));
  process.exit(ExitCode.RuntimeError);
});
