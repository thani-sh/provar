import * as fs from "fs";
import * as path from "path";
import pc from "picocolors";
import { execute, loadProject } from "@libs/engine";
import { findFilesByExtension } from "../../utils/fs";

export async function handleRun(args: string[]) {
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
      console.log(pc.dim(`  ⚙ Loaded Variables: ${JSON.stringify(variables)}`));
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
