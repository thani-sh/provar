import * as fs from "fs";
import * as path from "path";
import pc from "picocolors";
import { compile, loadProject, CompileAbortedError } from "@libs/engine";
import {
  loadSettings,
  assertProviderConfigured,
  ProviderConfigError as ConfigProviderError,
} from "@libs/config";
import { ProviderConfigError as ModelsProviderError } from "@libs/models";
import { renderTraceReport } from "../../utils/telemetry";
import { isCancelled, onCancel } from "../../utils/signal";
import { ExitCode } from "../../utils/exit-codes";

/**
 * handleCompile implements `provar compile <target> [--trace]`. Iterates over the resolved
 * file list, calls the engine `compile` for each, and prints per-file progress. Honours
 * SIGINT/SIGTERM via the shared signal util: between files we check `isCancelled()`, and
 * the engine itself checks an AbortSignal before each LLM round-trip so an in-flight call
 * always runs to completion before the engine throws `CompileAbortedError`.
 *
 * Exit codes follow the convention: 0 = success, 1 = runtime error, 2 = usage error,
 * 130 = SIGINT.
 */
export async function handleCompile(args: string[]): Promise<void> {
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
      process.exit(ExitCode.UsageError);
    }
    filesToCompile.push(resolvedPath);
  } else if (stat.isDirectory()) {
    try {
      const project = await loadProject(resolvedPath);
      filesToCompile = project.files.map((f) => f.path);
    } catch (err: any) {
      console.error(pc.red(`❌ Error loading project: ${err.message}`));
      process.exit(ExitCode.RuntimeError);
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
      process.exit(ExitCode.RuntimeError);
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

  // One AbortController covers the entire batch — every `compile()` call
  // shares the same signal, so a single SIGINT aborts both the in-flight
  // LLM call (via the engine's pre-LLM check) and the file-level loop
  // here (via isCancelled() between iterations).
  const ctrl = new AbortController();
  const signal = ctrl.signal;

  // Hook the controller into the shared SIGINT/SIGTERM flow. The signal
  // util's own onSecondSignal will force-exit with 130 if the user
  // presses Ctrl-C a second time while the engine's finally block is
  // still draining.
  onCancel(() => {
    if (!ctrl.signal.aborted) {
      ctrl.abort();
    }
  });

  let aborted = false;

  for (const yamlPath of filesToCompile) {
    if (isCancelled()) {
      aborted = true;
      break;
    }
    console.log(`\n⚙ Compiling: ${pc.cyan(yamlPath)}`);
    try {
      const result = await compile({ yamlPath, agentConfig, signal });

      console.log(
        `  ${pc.green("✔")} Compiled to: ${pc.bold(result.outputPath)} (${pc.dim(result.pathsResolved + " paths")})`,
      );
      successCount++;

      if (traceEnabled && result.trace) {
        renderTraceReport(result.trace);
      }
    } catch (err: any) {
      if (err instanceof CompileAbortedError) {
        // The engine aborted because our signal was set. Stop the loop
        // and let the dispatch layer exit with 130.
        aborted = true;
        break;
      }
      if (
        err instanceof ConfigProviderError ||
        err instanceof ModelsProviderError
      ) {
        // Defense in depth — the engine calls createClient which re-checks.
        console.error(pc.red(`\n❌ Cannot compile tests: ${err.message}`));
        process.exit(ExitCode.RuntimeError);
      }
      console.error(
        `  ${pc.red("✖")} Compilation Failed: ${pc.red(err.message)}`,
      );
    }
  }

  if (aborted) {
    console.log(
      pc.yellow(
        `\n⏹  Compilation cancelled. ${successCount} of ${filesToCompile.length} target(s) completed before the signal.`,
      ),
    );
    process.exit(ExitCode.SigInt);
  }

  console.log(
    pc.bold(
      pc.green(
        `\n🎉 Compilation finished! Successfully compiled [${successCount}/${filesToCompile.length}] targets.`,
      ),
    ),
  );
  if (successCount < filesToCompile.length) {
    process.exit(ExitCode.RuntimeError);
  }
  process.exit(ExitCode.Success);
}
