<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";

	// Build the GitHub Actions YAML in JS so the Svelte template parser does not interpret
	// the `${` in the `${{ secrets.OPENAI_API_KEY }}` expression. See STYLE.md § 2.
	const jobYaml = `# .github/workflows/provar.yml
name: provar
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.1
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - name: Run provar tests
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: bun --cwd apps/provar-cli -- run .
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: provar-failures
          path: .provar/screenshots/`;

	// Same reason: GitHub Actions cache step uses `${{ ... }}` expressions.
	const cacheYaml = `- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-\${{ runner.os }}-\${{ hashFiles('bun.lock') }}
  id: playwright-cache`;
</script>

<svelte:head>
	<title>provar-cli — Provar docs</title>
	<meta
		name="description"
		content="The Provar command-line interface. Compile and run .test.yml files from a terminal, in CI, or on a tiny VPS."
	/>
</svelte:head>

<h1>
	<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span><span
		class="text-on-surface-variant">cli</span
	>
</h1>
<p>
	The command-line interface. Compile and run <code>.test.yml</code> graphs from a terminal,
	without spinning up the desktop editor. Tiny surface area, no GUI dependencies, runs
	anywhere Bun runs — including CI, including the smallest Hetzner box, including a friend's
	laptop. If you live in a terminal anyway, start here.
</p>

<h2>What it actually is</h2>
<p>
	provar-cli is a small Bun executable. Three subcommands: <code>init</code> scaffolds a new
	project (with a <code>--sample</code> flag for the bundled starter), <code>compile</code>
	turns <code>.test.yml</code> graphs into runnable TypeScript, and <code>run</code> executes
	those scripts against a target. No Electron, no native shell, no bundled browser — bring
	your own Chromium via Playwright when you need to render the page.
</p>

<DocsPlaceholder caption="Terminal showing `provar run .` with green pass results (placeholder)" />

<h2>System requirements</h2>
<ul>
	<li>
		<strong>Operating system.</strong> macOS, Linux, or Windows. Anywhere Bun runs, the CLI
		runs. The Playwright browser bundle is what actually cares about the OS, and it supports
		all three.
	</li>
	<li>
		<strong>Bun 1.1 or later.</strong> The CLI ships as a Bun-native TypeScript entry point.
		Install from <a href="https://bun.sh" target="_blank" rel="noopener">bun.sh</a>.
	</li>
	<li>
		<strong>Playwright (only when you need a real browser).</strong> Tests that exercise a
		web UI need a Chromium binary on disk. One-time install:
		<code>bunx playwright install chromium</code>. Pure-compile workflows (CI sanity
		checks, PR-time graph validation) don't need it.
	</li>
	<li>
		<strong>LLM API key.</strong> Same as the editor — OpenAI, Anthropic, or any OpenAI-shape
		endpoint. Set it as an environment variable (<code>OPENAI_API_KEY</code> etc.) and the
		CLI picks it up.
	</li>
	<li>
		<strong>Disk.</strong> ~30 MB for the CLI itself. Playwright's Chromium is the big
		chunk if you need it (~170 MB on Linux). The CLI is comfortable on a 10-GB VPS.
	</li>
	<li>
		<strong>RAM.</strong> 512 MB is enough for compile-only and dry-runs. Real browser runs
		want 2 GB minimum to keep headless Chromium happy.
	</li>
</ul>

<h2>Quickstart</h2>
<p>
	From "I have Bun" to "I ran a test" in under two minutes. If you'd rather draw your tests on
	a canvas than write YAML, see the
	<a href="/docs/products/provar-app">provar-app quickstart</a> instead.
</p>

<h3>1. Clone the repo</h3>
<pre><code>git clone https://github.com/thani-sh/provar.git
cd provar
bun install</code></pre>

<h3>2. Create a new project</h3>
<p>
	The <code>init</code> subcommand scaffolds a fresh project, with a
	<code>--sample</code> flag for the bundled starter:
</p>
<pre><code>bun --cwd apps/provar-cli -- init my-app --sample
cd my-app</code></pre>
<p>
	You'll end up with a <code>my-app/</code> directory containing a working
	<code>.provar/</code> folder and a <code>login-flow.test.yml</code> ready to compile.
</p>

<h3>3. Add your API key</h3>
<p>
	Set the key as an environment variable. The CLI reads it on every invocation; nothing is
	written to disk.
</p>
<pre><code>export OPENAI_API_KEY=sk-...</code></pre>
<p>
	(Use a CI secret for the same value in pipelines. The
	<a href="#ci-configuration">CI configuration</a> section below has the recipe.)
</p>

<h3>4. Compile a test</h3>
<pre><code>bun --cwd apps/provar-cli -- compile .provar/tests/auth/login-flow.test.yml</code></pre>
<p>
	The CLI calls the LLM, generates the underlying TypeScript, and writes
	<code>login-flow.test.ts</code> next to the YAML. With <code>--trace</code> you also get a
	performance breakdown of the compile.
</p>

<h3>5. Run the test</h3>
<p>
	Make sure your target app is up, then run the compiled script. Headless is the default,
	which is what you want for CI:
</p>
<pre><code>bun --cwd apps/provar-cli -- run .</code></pre>
<p>
	The <code>--up-to &lt;taskId&gt;</code> flag stops execution at a given step — useful when
	debugging a failing mid-graph step. <code>--headless false</code> launches a real browser
	window, which is what you want locally.
</p>

<DocsPlaceholder
	caption="Terminal mid-run showing per-step progress and exit code 0 (placeholder)"
/>

<h3>6. Run everything in a project</h3>
<pre><code>bun --cwd apps/provar-cli -- run .</code></pre>
<p>
	Point <code>run</code> at a directory and the CLI discovers every
	<code>.test.ts</code> under it. Combined with <code>compile</code> in a one-liner, you have
	the full test loop:
</p>
<pre><code>bun --cwd apps/provar-cli -- compile . && bun --cwd apps/provar-cli -- run .</code></pre>

<h2 id="ci-configuration">CI configuration</h2>
<p>
	provar-cli is designed to be boring in CI: install Bun, install Playwright, install the CLI
	once, and then the same commands you ran locally. The CLI exits with the documented codes
	(<a href="/docs/running">0 / 1 / 2 / 130</a>), so any CI system can read the result.
</p>

<h3>Install pattern</h3>
<p>The minimum install for a CI job:</p>
<pre><code># 1. Install Bun
curl -fsSL https://bun.sh/install | bash

# 2. Install Playwright browsers (only if your tests need a real browser)
bunx playwright install --with-deps chromium

# 3. Install Provar workspace deps
bun install --frozen-lockfile</code></pre>
<p>
	The <code>--frozen-lockfile</code> flag is the one you actually want in CI — it fails the
	job if <code>bun.lock</code> is out of date, so reviewers don't have to guess whether the
	lockfile change is intentional.
</p>

<h3>Environment variables</h3>
<p>
	Everything the CLI needs is an environment variable. None of these are required for
	compile-only jobs.
</p>
<ul>
	<li>
		<code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code> / <code>OPENAI_API_BASE</code>
		— exactly one of the keys, plus <code>OPENAI_API_BASE</code> if you're pointing at a
		non-OpenAI endpoint that speaks the same shape.
	</li>
	<li>
		<code>PLAYWRIGHT_BROWSERS_PATH</code> — only if you've moved the browser bundle off its
		default path.
	</li>
	<li>
		<code>PROVAR_HEADLESS</code> — set to <code>false</code> in jobs that have a display
		(e.g. self-hosted runners with a virtual framebuffer). Default is <code>true</code>,
		which is what most CI wants.
	</li>
</ul>

<h3>Recommended job shape</h3>
<p>
	A minimal GitHub Actions job for provar-cli, kept short so it's easy to copy into a
	workflow:
</p>
<pre><code>{jobYaml}</code></pre>
<p>
	The artifact upload is the part most teams forget on their first attempt. When a test
	fails in CI you want the diff screenshot, not a "works on my machine" thread a week later.
</p>

<h3>Caching</h3>
<p>
	Cache the Playwright browser bundle between runs. On GitHub Actions:
</p>
<pre><code>{cacheYaml}</code></pre>
<p>
	Keying on <code>bun.lock</code> invalidates the cache when Bun updates a Playwright
	dependency, which is the only time the browser bundle changes too.
</p>

<p class="text-on-surface-variant text-sm">
	For higher-level CI configuration (caching strategies, matrix setups, secrets across
	GitHub / GitLab / CircleCI), see the <a href="/docs/ci">CI integration</a> page. The
	recipe above is the smallest possible job; the other page covers the more elaborate
	options.
</p>
