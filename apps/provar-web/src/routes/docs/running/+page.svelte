<h1>Running tests</h1>
<p>
	You can run a test from the editor, from the CLI, or from CI. All three paths produce the
	same results because they share the same engine. Pick whichever fits where you are: editor
	when you're iterating, CLI when you're scripting, CI when you've stopped being the one to run
	them.
</p>

<h2>From the editor</h2>
<p>
	Click the Run button (▶) in the toolbar. The editor compiles the YAML graph and executes it
	against your app. Per-step progress streams into the run panel on the right, and the canvas
	highlights the active path as it goes. When a step's snapshot doesn't match the baseline,
	the diff shows up right there in the panel.
</p>

<h2>From the CLI</h2>
<p>Compile a project (writes the compiled scripts next to each <code>.test.yml</code>):</p>
<pre><code>provar compile .</code></pre>
<p>Run everything in the project:</p>
<pre><code>provar run .</code></pre>
<p>Run with a visible browser window (default is headless, what CI wants):</p>
<pre><code>provar run . --headless false</code></pre>
<p>Stop at a given step — works for both compile and run:</p>
<pre><code>provar run . --up-to enter_credentials</code></pre>
<p>
	The <code>--up-to</code> flag runs the named step and everything before it, then stops. Use
	it when you're chasing a failing step in a long test — you can see it execute without
	waiting for the whole graph to drain.
</p>

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