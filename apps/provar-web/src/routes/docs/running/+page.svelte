<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Running tests</h1>
<p>
	You can run a test from the editor, from the CLI, or from CI. All three paths produce the same
	results because they share the same engine.
</p>

<h2>From the editor</h2>
<p>
	Click the Run button (▶) in the toolbar. The editor compiles the YAML graph and executes it
	against your app. Per-step progress appears in the run panel; the canvas highlights the active
	path.
</p>

<DocsPlaceholder caption="Run panel mid-execution with per-step progress (placeholder)" />

<h2>From the CLI</h2>
<p>Compile and run a single test file:</p>
<pre><code>bun --cwd apps/provar-cli -- run .provar/tests/auth/login-flow.test.ts</code></pre>
<p>Run every test in a project:</p>
<pre><code>bun --cwd apps/provar-cli -- run .</code></pre>
<p>Compile only (no execution), with a performance trace:</p>
<pre><code>bun --cwd apps/provar-cli -- compile .provar/tests/auth/login-flow.test.ts --trace</code></pre>

<h2>Exit codes</h2>
<ul>
	<li><code>0</code> — every path passed.</li>
	<li><code>1</code> — runtime error (a step failed, the browser crashed, etc.).</li>
	<li><code>2</code> — usage error (unknown subcommand or bad flag).</li>
	<li><code>130</code> — interrupted (Ctrl-C / SIGTERM). In-flight work is awaited cleanly
		before the process exits.</li>
</ul>

<p class="text-on-surface-variant text-sm">
	For CI-specific configuration (caching, parallelism, matrix), see
	<a href="/docs/ci">CI integration</a>.
</p>
