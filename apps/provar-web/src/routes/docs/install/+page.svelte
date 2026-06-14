<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Install</h1>
<p>
	Provar ships as two artifacts: the desktop editor (<code>provar-app</code>) and the command-line
	interface (<code>provar</code>). Most users want both — the editor for authoring, the CLI for
	CI and for users who prefer the terminal.
</p>

<blockquote>
	<strong>Early-development notice.</strong> Provar is pre-1.0 with no active external users. The
	one-line installer at <code>provar.se/install.sh</code> is being prepared and is not yet live.
	Until then, follow the manual steps below.
</blockquote>

<h2>Prerequisites</h2>
<ul>
	<li>
		<a href="https://bun.sh" target="_blank" rel="noopener">Bun</a> 1.1 or later. The install
		command on the Bun homepage is the recommended path.
	</li>
	<li>
		<a href="https://playwright.dev" target="_blank" rel="noopener">Playwright</a> browsers.
		Provar uses Chromium under the hood; install it once with
		<code>bunx playwright install chromium</code>.
	</li>
	<li>An LLM API key for one of the supported providers (OpenAI, Anthropic, or a compatible
		OpenAI-shape endpoint).</li>
</ul>

<h2>macOS / Linux</h2>
<p>From the directory where you keep developer tools:</p>
<pre><code>git clone https://github.com/thani-sh/provar.git
cd provar
bun install
bun --cwd apps/provar-app dev          # launches the desktop editor
bun --cwd apps/provar-cli -- --help    # smoke-test the CLI</code></pre>

<h2>Windows (WSL)</h2>
<p>
	Use the same steps inside a WSL 2 distribution. The editor uses Electrobun, which renders
	through the host browser engine; on WSL you can either run it in WSL with an X server or, more
	commonly, install Bun on Windows and clone the repo on the Windows filesystem so the editor
	uses the native Chromium.
</p>

<h2>Verify the install</h2>
<p>The CLI self-check prints version info and exits 0:</p>
<pre><code>bun --cwd apps/provar-cli -- --help</code></pre>
<p>You should see the usage banner listing <code>init</code>, <code>run</code>, and
	<code>compile</code>.</p>

<DocsPlaceholder caption="Terminal showing `provar --help` output (placeholder)" />
