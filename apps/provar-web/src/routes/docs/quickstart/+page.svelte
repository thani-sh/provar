<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<svelte:head>
	<title>5-minute quickstart — Provar docs</title>
	<meta
		name="description"
		content="From a clean checkout of Provar to a passing test run against the demo-social sample in under five minutes."
	/>
</svelte:head>

<h1>5-minute quickstart</h1>
<p>
	This guide walks you from a clean checkout of Provar to a passing test run against the
	<strong>demo-social</strong> sample. If you have already installed the prerequisites (see
	<a href="/docs/install">Install</a>), you should be done in under five minutes.
</p>

<h2>1. Launch the editor</h2>
<p>From the repository root:</p>
<pre><code>bun --cwd apps/provar-app dev</code></pre>
<p>
	The editor opens to the empty-state screen. You'll see two cards: <strong>Create sample
	project</strong> (recommended) and <strong>Open a folder</strong>.
</p>

<DocsPlaceholder caption="Editor empty-state with two action cards (placeholder)" />

<h2>2. Clone the sample project</h2>
<p>
	Click <strong>Create sample project</strong>. A native folder picker opens. Pick a folder
	that is <em>outside</em> the cloned <code>provar</code> repo (e.g.
	<code>~/Code/provar-sample</code>). The editor runs
	<code>git clone https://github.com/thani-sh/demo-social</code> into
	<code>&lt;destination&gt;/demo-social/</code> and opens it as the active project.
</p>
<p>
	The cloned repo is a self-contained microblogging app with a 5-step login test already wired
	up against it. You don't need to install or configure anything else to run it — just point
	your browser at <code>http://localhost:6001</code> (after step 4) and log in with the seed
	credentials in the repo's README.
</p>

<h2>3. Add your LLM API key</h2>
<p>
	The editor's first action is to open the Settings dialog (Provar → Settings…). Paste your
	API key, save, and the dialog closes. The key lives in
	<code>~/.provar/settings.json</code> — it never leaves your machine.
</p>

<DocsPlaceholder caption="Settings dialog with the API key field highlighted (placeholder)" />

<h2>4. Start the sample app</h2>
<p>
	From a second terminal, run the cloned sample so the editor has something to point at:
</p>
<pre><code>cd ~/Code/provar-sample/demo-social
bun install
bun run dev</code></pre>
<p>
	The server listens on <code>http://localhost:6001</code>. Leave it running in the background
	— the editor will hit it as it executes each step.
</p>

<h2>5. Run the test</h2>
<p>
	Back in the editor, the project explorer pre-selects
	<code>login-flow.test.yml</code>. Click the Run button (▶) in the toolbar. The editor
	compiles the YAML graph into a runnable script (this is the AI call), then executes it
	against the sample target.
</p>
<p>
	On the first run, every step records a new snapshot. Accept the snapshots when prompted —
	you should now see a green pass on every step.
</p>

<DocsPlaceholder caption="Run toolbar with a green pass result on the 5 steps (placeholder)" />

<h2>6. Replace the sample with your own app</h2>
<p>
	Edit <code>.provar/config.yml</code> in the sample project: change
	<code>variables.baseUrl</code> to your own app's URL. Open one of the steps and click
	<em>Regenerate</em> — the agent re-runs the step against your app and updates the underlying
	code. Repeat for each step until all five pass.
</p>

<p class="text-on-surface-variant text-sm">
	Stuck? See <a href="/docs/troubleshooting">Troubleshooting</a> for the ten most common
	problems beginners hit on their first run, or jump to
	<a href="/docs/authoring">Authoring tests</a> to learn how to write your own from scratch.
</p>
