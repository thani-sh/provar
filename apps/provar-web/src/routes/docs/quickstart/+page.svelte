<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<svelte:head>
	<title>Quickstart — Provar docs</title>
	<meta
		name="description"
		content="From a fresh download of Provar to a passing test run against the demo-social sample in about five minutes."
	/>
</svelte:head>

<h1>Quickstart</h1>
<p>
	Five minutes from "I've never run Provar" to "I've got a passing test" using the bundled
	<a href="https://github.com/thani-sh/demo-social" target="_blank" rel="noopener">demo-social</a>
	sample. If something blocks you, the
	<a href="/docs/troubleshooting">troubleshooting page</a> covers the ten most common ways this
	goes sideways — make a coffee in the meantime.
</p>

<h2>Step 1: Install the app</h2>
<p>
	Grab the desktop build for your platform. The installer ships Provar — the editor, the
	engine, the runtime — all in one package. No separate toolchain to set up first.
</p>
<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
	<div
		class="border-outline-variant/60 bg-surface-container-low flex flex-col gap-1 rounded-xl border p-3"
	>
		<p class="text-on-surface text-sm font-semibold">macOS</p>
		<p class="text-on-surface-variant text-xs leading-snug">
			Download Provar.app and drag it to your Applications directory.
		</p>
	</div>
	<div
		class="border-outline-variant/60 bg-surface-container-low flex flex-col gap-1 rounded-xl border p-3"
	>
		<p class="text-on-surface text-sm font-semibold">Windows</p>
		<p class="text-on-surface-variant text-xs leading-snug">
			Download and run the provar-desktop.exe file
		</p>
	</div>
	<div
		class="border-outline-variant/60 bg-surface-container-low flex flex-col gap-1 rounded-xl border p-3"
	>
		<p class="text-on-surface text-sm font-semibold">Linux</p>
		<p class="text-on-surface-variant text-xs leading-snug">
			coming soon
		</p>
	</div>
</div>

<h2>Step 2: Try the sample project</h2>
<p>
	Launch the editor. The empty-state screen shows two cards: <strong>Create sample project</strong>
	(recommended) and <strong>Open a folder</strong>. Click the first one.
</p>
<p>
	A native folder picker opens. Pick a temporary directory you'll be happy to delete later —
	for example, <code>~/Code/provar-sample</code>. The editor clones
	<a href="https://github.com/thani-sh/demo-social" target="_blank" rel="noopener">demo-social</a>
	into the chosen folder and opens it as the active project. The sample is a tiny microblogging
	app with some example tests.
</p>
<p>
	Open a terminal, change into the sample folder, and start its dev server:
</p>
<pre><code>cd ~/Code/provar-sample/demo-social
bun run dev</code></pre>
<p>
	The server listens on <code>http://localhost:6001</code>. Leave it running in the background —
	the editor will hit it as each step executes. (Bun ships with the editor's bundled toolchain,
	so you don't need to install it separately.)
</p>
<p>
	Back in the editor, the project explorer shows the sample's tests with the first one
	pre-selected. Click the Run button (▶) in the toolbar. The editor executes the test against
	the running sample. First run: every step records a fresh snapshot. Accept the snapshots when
	prompted — you should see green checkmarks across the board. If you see red, don't panic;
	the <a href="/docs/troubleshooting">troubleshooting page</a> has you covered.
</p>

<DocsPlaceholder
	caption="Video: walking through opening the sample, starting the dev server, and running the first test (placeholder)"
/>

<h2>Step 3: Start a new project</h2>
<p>
	Back at the editor's empty-state screen, click <strong>Open a folder</strong> this time and
	pick a directory that contains (or will contain) your application. The editor creates the
	<code>.provar/</code> scaffold — <code>config.yml</code>, a <code>tests/</code> folder, an
	empty <code>screenshots/</code> folder. Nothing in your app folder is touched.
</p>
<p>
	Open <code>.provar/config.yml</code> and set <code>variables.baseUrl</code> to your app's
	URL. Then, in the editor, draw a first step on the canvas — pick the start node, edit its
	<code>title</code> and <code>info</code> in the right sidebar, and click
	<em>Regenerate</em>. The first time you regenerate, the editor asks for an LLM API key — see
	the note below if you want to set one up.
</p>
<p>
	Once the key is in place, the agent writes the Playwright code for that step and runs it
	against your app. The new TypeScript shows up as a regular file in your project — reviewable,
	diffable, runnable on its own. Add more steps, regenerate each one, and you've got a real
	test suite for your own app.
</p>

<DocsPlaceholder caption="Editor canvas with the first step for a custom app (placeholder)" />

<p>
	From here on out, writing a test is "draw a step, describe what it should do, regenerate,
	accept the snapshot." The agent does the boring Playwright bit; you do the part that
	requires knowing what your app is supposed to do.
</p>

<h2>About the AI features</h2>
<p>
	Provar's visual editor, the canvas, the snapshot review, the local test engine — all of that
	works without an LLM. You only need an API key when you want the agent to <em>write</em> new
	code for a step (via the Regenerate button) or use the assistant panel.
</p>
<p>
		Supported providers: OpenAI, Anthropic, or any OpenAI-shape endpoint. Set the key once via
		Provar → Settings… and the editor stores it locally at
		<code>~/.provar/settings.yml</code>. It never leaves your machine.
	</p>
<p class="text-on-surface-variant text-sm">
	If you'd rather drive everything from a terminal — no GUI, no key required for the test
	loop — see the <a href="/docs/products/provar-cli">provar-cli quickstart</a>. It uses the
	same engine, just without the canvas.
</p>
