<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Running tests</h1>
<p>
	You can run a test from the editor, from the CLI, or from CI. All three paths produce the
	same results because they share the same engine. Pick whichever fits where you are: editor
	when you're iterating, CLI when you're scripting, CI when you've stopped being the one to
	run them.
</p>

<h2>From the editor</h2>
<p>
	Click the Run button (▶) in the toolbar. The editor compiles the YAML graph and executes it
	against your app. Per-step progress streams into the run panel on the right, and the canvas
	highlights the active path as it goes. When a step's snapshot doesn't match the baseline,
	the diff shows up right there in the panel.
</p>

<DocsPlaceholder caption="Run panel mid-execution with per-step progress (placeholder)" />

<h2>From the CLI</h2>
<p>Compile and run a single test file:</p>
<pre><code>bun --cwd apps/provar-cli -- run .provar/tests/auth/login-flow.test.ts</code></pre>
<p>Run every test in the project:</p>
<pre><code>bun --cwd apps/provar-cli -- run .</code></pre>
<p>Compile only, no execution, with a performance trace:</p>
<pre><code>bun --cwd apps/provar-cli -- compile .provar/tests/auth/login-flow.test.ts --trace</code></pre>

<h2>Exit codes</h2>
<ul>
	<li><code>0</code> — every path passed. Ship it.</li>
	<li><code>1</code> — runtime error. A step failed, the browser crashed, the agent returned
		something nonsensical, etc.</li>
	<li><code>2</code> — usage error. Unknown subcommand, bad flag, typo in a path.</li>
	<li><code>130</code> — interrupted (Ctrl-C / SIGTERM). Anything in flight is awaited cleanly
		before the process exits, so you won't get half-written files on disk.</li>
</ul>
<p>
	These are stable contracts — CI systems, scripts, and the editor all depend on them. The
	troubleshooting page has notes for the cases where local and CI disagree.
</p>

<p class="text-on-surface-variant text-sm">
	For CI-specific configuration (caching, parallelism, secrets), see
	<a href="/docs/ci">CI integration</a>.
</p>
