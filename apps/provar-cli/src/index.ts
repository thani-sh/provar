import { runTest } from "@libs/executor";
import { compile } from "@libs/compiler";
import pc from "picocolors";
import * as path from "path";
import * as fs from "fs";
import yaml from "js-yaml";

function findAndLoadVariables(testFilePath: string): Record<string, any> {
  let currentDir = path.dirname(testFilePath);
  const rootDir = path.parse(currentDir).root;

  while (currentDir && currentDir !== rootDir) {
    const configPath = path.join(currentDir, ".provar", "config.yml");
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        const doc = yaml.load(content) as any;
        const rawVariables = doc?.variables || {};

        // Resolve environment variables using ${ENV.VAR_NAME} mapping
        const resolved: Record<string, any> = {};
        for (const [key, val] of Object.entries(rawVariables)) {
          if (typeof val === "string") {
            const envMatch = val.match(/^\$\{ENV\.(.+)\}$/);
            if (envMatch && envMatch[1]) {
              resolved[key] = process.env[envMatch[1]] || "";
            } else {
              resolved[key] = val;
            }
          } else {
            resolved[key] = val;
          }
        }
        return resolved;
      } catch (err: any) {
        console.warn(
          pc.yellow(
            `⚠️  Failed to parse config at ${configPath}: ${err.message}`,
          ),
        );
      }
    }
    currentDir = path.dirname(currentDir);
  }
  return {};
}

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
      "  provar compile <test-file-path|dir>        Compile a single file or a whole directory",
    );
    console.log("\nOptions:");
    console.log(
      "  --up-to <actionId>                         Execute the test only up to this action ID",
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
      filesToCompile = findFilesByExtension(resolvedPath, ".test.yml");
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

    for (const yamlPath of filesToCompile) {
      console.log(`\n⚙ Compiling: ${pc.cyan(yamlPath)}`);
      try {
        const result = await compile({ yamlPath });
        console.log(
          `  ${pc.green("✔")} Compiled to: ${pc.bold(result.outputPath)} (${pc.dim(result.pathsResolved + " paths")})`,
        );
        successCount++;
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
    return;
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
    let upToActionId: string | undefined;
    let headless = true;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--up-to") {
        upToActionId = args[i + 1];
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

      const variables = findAndLoadVariables(testFilePath);
      if (Object.keys(variables).length > 0) {
        console.log(
          pc.dim(`  ⚙ Loaded Variables: ${JSON.stringify(variables)}`),
        );
      }

      const runner = runTest({
        testFilePath,
        upToActionId,
        headless,
        variables,
      });

      let suiteSuccess = true;
      for await (const event of runner.events()) {
        switch (event.type) {
          case "run-started":
            console.log(pc.yellow("  • Test run initialized..."));
            break;
          case "test-started":
            console.log(
              `\n  🎬 ${pc.bold(pc.magenta(`Running Path Suite: "${event.testName}"`))}`,
            );
            break;
          case "action-started":
            console.log(
              `    ${pc.cyan("⏳")} ${event.actionTitle} (${pc.dim(event.actionId)})...`,
            );
            break;
          case "action-finished":
            console.log(`    ${pc.green("✔")} ${pc.green("Completed")}`);
            break;
          case "action-failed":
            console.log(
              `    ${pc.red("✖")} ${pc.red("Failed:")} ${pc.bold(event.error.message || event.error)}`,
            );
            break;
          case "test-finished":
            const color = event.status === "success" ? pc.green : pc.red;
            console.log(
              `  🏁 Path Finished: ${color(event.status.toUpperCase())}`,
            );
            break;
          case "run-finished":
            if (event.status === "failed") {
              suiteSuccess = false;
              runSuccess = false;
            }
            break;
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
  }
}

main().catch((err) => {
  console.error(pc.red(`Fatal CLI Error: ${err.message}`));
  process.exit(1);
});
