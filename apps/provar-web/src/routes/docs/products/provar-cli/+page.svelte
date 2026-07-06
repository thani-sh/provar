<script>
	import { buildInfo } from "$lib/build-info";
</script>

<svelte:head>
	<title>provar-cli — Provar docs</title>
	<meta
		name="description"
		content="The Provar command-line interface. Compile and run .test.yml files from a terminal."
	/>
</svelte:head>

<h1>
	<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span><span
		class="text-on-surface-variant">cli</span
	>
</h1>
<p>
	The command-line interface. Compile and run <code>.test.yml</code> graphs from a terminal,
	without spinning up the desktop editor. Three subcommands:
	<code>setup</code> scaffolds a new project (with <code>--sample</code> for the bundled
	starter), <code>compile</code> turns graphs into machine-friendly scripts,
	<code>run</code> executes them against a target.
</p>

<h2>Quickstart</h2>

<h3>1. Install</h3>
<pre><code>curl -fsSL {buildInfo.url}/install.sh | bash</code></pre>
<p>macOS and Linux. Windows users grab a binary from the
	<a href="https://github.com/thani-sh/provar/releases" target="_blank" rel="noopener"
		>GitHub releases page</a
	>.
</p>

<h3>2. Scaffold a project</h3>
<pre><code>provar setup my-app --sample
cd my-app</code></pre>
<p><code>--sample</code> gives you a working login file pointing at a live demo.</p>

<h3 id="configuration">3. Add your API key</h3>
<p>
	Edit <code>~/.provar/settings.yml</code>. The CLI writes defaults on first run. Add an
	<code>apiKey</code> for the provider you want:
</p>
<pre><code># ~/.provar/settings.yml
models:
  provider: openai
  providers:
    openai:
      model: gpt-5.5
      apiKey: sk-...
    google:
      model: gemini-3.5-flash
    anthropic:
      model: claude-5-sonnet-latest</code></pre>
<p>
	Providers: <code>openai</code>, <code>anthropic</code>, <code>google</code>. Set a custom
	<code>baseUrl</code> on a provider entry to point at any OpenAI-shape endpoint (local Llama,
	Ollama, etc.).
</p>

<h3>4. Compile and run</h3>
<pre><code>provar compile .
provar run .</code></pre>

<h3>5. Point it at your own app</h3>
<p>
	Edit <code>.provar/config.yml</code>, change <code>variables.baseUrl</code>, recompile. When
	the UI drifts, recompile the file and the agent rewrites the broken action.
</p>
<p>
	Variables are overridable at run time via env:
	<code>BASE_URL=http://staging.example.com provar run .</code>
</p>

<h2>CI</h2>
<pre><code># .github/workflows/provar.yml
name: provar
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: curl -fsSL {buildInfo.url}/install.sh | bash
      - run: provar run .</code></pre>
<p class="text-on-surface-variant text-sm">
	Pre-job secrets, matrix setups, GitLab / CircleCI recipes — see
	<a href="/docs/ci">CI integration</a>.
</p>