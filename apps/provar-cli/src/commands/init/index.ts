import { existsSync, mkdirSync, cpSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import pc from "picocolors";
import { PROVAR_DIR, TESTS_DIR, CONFIG_FILE } from "@libs/config/paths";

/**
 * handleInit implements `provar init <name> [--sample]` — create a new Provar project directory.
 *
 * Without --sample, it creates an empty project skeleton (`.provar/tests/`, `.provar/screenshots/`,
 * and a minimal `config.yml`). With --sample, it copies the bundled sample project from
 * `apps/provar-app/sample-projects/todo-app/` into the destination, so a new user can run a
 * passing test in under five minutes with no further configuration.
 */
export async function handleInit(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith("-"));
  const flags = new Set(args.filter((a) => a.startsWith("-")));

  if (flags.has("--help") || flags.has("-h") || positional.length === 0) {
    console.log(pc.cyan("provar init — create a new Provar project"));
    console.log("\nUsage:");
    console.log("  provar init <name|path> [--sample]");
    console.log("\nOptions:");
    console.log(
      "  --sample    Copy the bundled sample project (recommended for first-time users)",
    );
    console.log(
      "  --force     Overwrite an existing directory if it already exists",
    );
    return;
  }

  const rawTarget = positional[0];
  if (typeof rawTarget !== "string") {
    console.error(
      pc.red("Project name is required. Run 'provar init --help'."),
    );
    process.exit(2);
  }

  const target = isAbsolute(rawTarget)
    ? rawTarget
    : resolve(process.cwd(), rawTarget);
  const useSample = flags.has("--sample");
  const force = flags.has("--force");

  if (existsSync(target) && !force) {
    console.error(
      pc.red(
        `Target directory already exists: ${target}\nRe-run with --force to overwrite, or pick a different name.`,
      ),
    );
    process.exit(1);
  }

  mkdirSync(target, { recursive: true });

  if (useSample) {
    const sampleSrc = resolveBundledSampleDir();
    if (!sampleSrc) {
      console.error(
        pc.red(
          "Could not locate the bundled sample project. Reinstall Provar or file a bug at https://github.com/thani-sh/provar/issues",
        ),
      );
      process.exit(1);
    }
    cpSync(sampleSrc, target, { recursive: true });
    console.log(
      pc.green(
        `Created sample project at ${target}.\nNext step: open it with 'provar-app' or 'provar run'.`,
      ),
    );
    return;
  }

  // Empty skeleton.
  mkdirSync(join(target, TESTS_DIR), { recursive: true });
  mkdirSync(join(target, PROVAR_DIR, "screenshots"), { recursive: true });
  writeFileSync(
    join(target, CONFIG_FILE),
    "variables:\n  baseUrl: http://127.0.0.1:3000\n",
  );
  console.log(
    pc.green(
      `Created empty Provar project at ${target}.\nTip: re-run with --sample to start from the bundled sample.`,
    ),
  );
}

/**
 * resolveBundledSampleDir returns the absolute path to the bundled sample project shipped with
 * the CLI package. The sample lives at `apps/provar-app/sample-projects/todo-app/` in the monorepo
 * and is resolved by walking up from the CLI's source location.
 */
function resolveBundledSampleDir(): string | null {
  try {
    // Bun: prefer import.meta.dirname (the directory containing this file). Fall back to
    // resolving from process.argv[1] for environments that don't set import.meta.dirname.
    const here =
      typeof import.meta.dirname === "string"
        ? import.meta.dirname
        : dirname(resolve(process.argv[1] ?? "."));
    for (let dir = here; dir !== dirname(dir); dir = dirname(dir)) {
      // Monorepo layout: <root>/apps/provar-app/sample-projects/todo-app
      const candidate = join(
        dir,
        "apps",
        "provar-app",
        "sample-projects",
        "todo-app",
        PROVAR_DIR,
      );
      if (existsSync(candidate)) {
        return join(dir, "apps", "provar-app", "sample-projects", "todo-app");
      }
      // Flat layout (sample shipped at the root of the distribution): <dir>/sample-projects/todo-app
      const flat = join(dir, "sample-projects", "todo-app", PROVAR_DIR);
      if (existsSync(flat)) {
        return join(dir, "sample-projects", "todo-app");
      }
    }
    return null;
  } catch {
    return null;
  }
}
