<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>5-minute quickstart</h1>
<p>
	This page walks you from a clean checkout of Provar to a passing test run against the bundled
	sample project. If you have already installed the prerequisites (see
	<a href="/docs/install">Install</a>), you should be done in under five minutes.
</p>

<h2>1. Launch the editor</h2>
<p>From the repository root:</p>
<pre><code>bun --cwd apps/provar-app dev</code></pre>
<p>The editor opens to the empty-state screen. You'll see two cards: "Create sample project"
	(recommended) and "Open a folder".</p>

<DocsPlaceholder caption="Editor empty-state with two action cards (placeholder)" />

<h2>2. Create the sample project</h2>
<p>
	Click <strong>Create sample project</strong>. A native folder picker opens. Pick a folder
	that is <em>outside</em> the cloned <code>provar</code> repo (e.g.
	<code>~/Code/provar-sample</code>). The editor copies a 5-step login test into that folder
	and opens it.
</p>

<h2>3. Add your LLM API key</h2>
<p>
	The editor's first action is to open the Settings dialog (Provar → Settings…). Paste your
	API key, save, and the dialog closes. The key lives in
	<code>~/.provar/settings.json</code> — it never leaves your machine.
</p>

<DocsPlaceholder caption="Settings dialog with the API key field highlighted (placeholder)" />

<h2>4. Run the test</h2>
<p>
	With the sample project open, the editor pre-selects
	<code>login-flow.test.yml</code>. Click the Run button (▶) in the toolbar. The editor
	compiles the YAML graph into a runnable script (this is the AI call), then executes it
	against the sample target.
</p>
<p>
	On the first run, every step records a new snapshot. Accept the snapshots when prompted —
	you should now see a green pass on every step.
</p>

<DocsPlaceholder caption="Run toolbar with a green pass result on the 5 steps (placeholder)" />

<h2>5. Replace the sample with your own app</h2>
<p>
	Edit <code>.provar/config.yml</code> in the sample project: change <code>variables.baseUrl</code>
	to your own app's URL. Open one of the steps and click <em>Regenerate</em> — the agent
	re-runs the step against your app and updates the underlying code. Repeat for each step until
	all five pass.
</p>

<p class="text-on-surface-variant text-sm">
	Stuck? See <a href="/docs/troubleshooting">Troubleshooting</a> for the ten most common
	problems beginners hit on their first run.
</p>
