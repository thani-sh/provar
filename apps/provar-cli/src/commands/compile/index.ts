import * as fs from "fs";
import * as path from "path";
import pc from "picocolors";
import { compile, loadProject } from "@libs/engine";
import {
  loadSettings,
  assertProviderConfigured,
  ProviderConfigError as ConfigProviderError,
} from "@libs/config";
import { ProviderConfigError as ModelsProviderError } from "@libs/models";
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

  // Gate: refuse to start the compile pipeline if the active provider has no
  // API key. We do this BEFORE iterating files so a single, actionable error
  // reaches the user instead of a stream of 401s from the LLM client.
  try {
    assertProviderConfigured(settings.models);
  } catch (err) {
    if (err instanceof ConfigProviderError) {
      const details = err.requirements
        .map((r: { message: string }) => r.message)
        .join(" ");
      console.error(pc.red(`\n❌ Cannot compile tests: ${details}`));
      console.error(
        pc.dim(
          `\n  Tip: edit ~/.provar/settings.json or run \`bun run provar\` and open Settings to add a key for provider "${settings.models.defaultProvider}".`,
        ),
      );
      process.exit(1);
    }
    throw err;
  }

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
      if (
        err instanceof ConfigProviderError ||
        err instanceof ModelsProviderError
      ) {
        // Defense in depth — the engine calls createClient which re-checks.
        console.error(pc.red(`\n❌ Cannot compile tests: ${err.message}`));
        process.exit(1);
      }
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
