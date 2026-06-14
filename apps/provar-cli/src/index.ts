import pc from "picocolors";
import { handleCompile } from "./commands/compile";
import { handleRun } from "./commands/run";
import { handleInit } from "./commands/init";

async function main() {
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
  process.exit(2);
}

main().catch((err) => {
  console.error(pc.red(`Fatal CLI Error: ${err.message}`));
  process.exit(1);
});
