import * as fs from "fs";
import * as path from "path";
import pc from "picocolors";
import { compile, loadProject } from "@libs/engine";
import { loadSettings } from "@libs/config";
import { renderTraceReport } from "../../utils/telemetry";

export async function handleCompile(args: string[]) {
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
