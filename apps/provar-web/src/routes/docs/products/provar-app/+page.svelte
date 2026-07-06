<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<svelte:head>
	<title>provar-app — Provar docs</title>
	<meta
		name="description"
		content="The Provar desktop editor. Visual canvas for end-to-end test authoring, with live snapshot review and AI-assisted code generation."
	/>
</svelte:head>

<h1>
	<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span><span
		class="text-on-surface-variant">app</span
	>
</h1>
<p>
	The desktop editor. A visual canvas where you draw the user journey as a graph of actions,
	the AI agent writes the underlying Playwright code, and the run panel shows you what
	actually happened — including a side-by-side snapshot diff when something changes. If you
	spend most of your day in a browser-based test tool, this is the one you want.
</p>

<h2>What it actually is</h2>
<p>
	provar-app is an
	<a href="https://electrobun.dev" target="_blank" rel="noopener">Electrobun</a> desktop
	application — a small native shell that loads the Svelte UI and a bundled Chromium for
	rendering files. It's a dev tool at heart, not a polished consumer app: a debug console in
	the dev build, a real release pipeline in tagged builds, and a UX that takes a few cues from
	Blender and Figma. You'll like it or you'll switch to the CLI; both are valid.
</p>

<DocsPlaceholder caption="Editor canvas with a 4-action login file (placeholder)" />

<h2>System requirements</h2>
<ul>
	<li>
		<strong>Operating system.</strong> macOS (Apple Silicon or Intel) for the packaged build.
		Linux and Windows are runnable from source; native installers for those are on the way.
	</li>
	<li>
		<strong>Bun 1.1 or later.</strong> The runtime that drives the dev server and bundles the
		UI. Install it from <a href="https://bun.sh" target="_blank" rel="noopener">bun.sh</a>.
	</li>
	<li>
		<strong>Playwright browsers (Chromium).</strong> Provar drives a real Chromium under the
		hood, so the browser binary has to be on disk. One-time install:
		<code>bunx playwright install chromium</code>.
	</li>
	<li>
		<strong>LLM API key.</strong> OpenAI, Anthropic, or any OpenAI-shape endpoint. Stored
		locally in <code>~/.provar/settings.json</code>; never uploaded.
	</li>
	<li>
		<strong>Disk.</strong> ~400 MB for the editor + bundled Chromium. Larger projects with
		many baselines add PNGs under <code>.provar/screenshots/</code>; budget a few MB per
		action.
	</li>
	<li>
		<strong>RAM.</strong> 8 GB minimum, 16 GB comfortable. The editor is fine on a small
		laptop; it's not fine on the 4 GB Chromebook.
	</li>
</ul>

<h2>Quickstart</h2>
<p>
	This is the shortest path from "I just cloned the repo" to "I have a passing file in the
	editor". If you'd rather drive everything from a terminal, see the
	<a href="/docs/products/provar-cli">provar-cli quickstart</a> instead.
</p>

<h3>1. Get the code</h3>
<pre><code>git clone https://github.com/thani-sh/provar.git
cd provar
bun install</code></pre>

<h3>2. Launch the editor</h3>
<pre><code>bun --cwd apps/provar-app dev</code></pre>
<p>
	The editor opens to an empty-state screen with two cards. Click <strong>Create sample
	project</strong> — that's the easy path. The editor will ask where to put the sample, clone
	<a href="https://github.com/thani-sh/demo-social" target="_blank" rel="noopener"
		>demo-social</a
	>
	into the chosen folder, and open it as the active project.
</p>

<DocsPlaceholder caption="Editor empty-state with the Create sample project card (placeholder)" />

<h3>3. Add your API key</h3>
<p>
	The first time you open a project, the editor asks for an LLM API key (Provar → Settings…).
	Paste it, save, done. The key lives at <code>~/.provar/settings.json</code>.
</p>

<DocsPlaceholder caption="Settings dialog with the API key field highlighted (placeholder)" />

<h3>4. Start the sample app</h3>
<p>In a second terminal:</p>
<pre><code>cd ~/Code/provar-sample/demo-social
bun install
bun run dev</code></pre>
<p>The server listens on <code>http://localhost:6001</code>. Leave it running.</p>

<h3>5. Run the file</h3>
<p>
	Back in the editor, the project explorer pre-selects
	<code>login-flow.test.yml</code>. Click the Run button (▶) in the toolbar. The editor
	compiles the YAML into Playwright code (one LLM round-trip per action the first time), then
	executes it. First run: accept the snapshots when prompted. You should see green across all
	five actions.
</p>

<DocsPlaceholder caption="Run panel with five green pass results (placeholder)" />

<h3>6. Point it at your own app</h3>
<p>
	Edit <code>.provar/config.yml</code> in the sample project and change
	<code>variables.baseUrl</code> to your app's URL. Click <em>Regenerate</em> on any action and
	the agent re-runs that action against your app. Repeat until everything's green.
</p>

<p class="text-on-surface-variant text-sm">
	Want the longer version? The <a href="/docs/quickstart">main quickstart</a> covers the same
	flow with more detail and a few extra tips. And if the editor isn't your speed, the
	<a href="/docs/products/provar-cli">provar-cli</a> page is the terminal-first counterpart.
</p>