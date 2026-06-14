<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Provar — end-user guide</h1>
<p>
	This guide is the canonical reference for someone who has just installed the Provar editor
	and wants to get to a passing end-to-end test as quickly as possible. It is structured so you
	can read it top to bottom on your first day, and then jump back to a specific page when you
	forget a detail.
</p>

<h2>Where to start</h2>
<ul>
	<li>
		<a href="/docs/install">Install</a> — get the desktop editor and the CLI on your machine.
	</li>
	<li>
		<a href="/docs/quickstart">5-minute quickstart</a> — open the editor, create the sample
		project, and run your first test.
	</li>
	<li>
		<a href="/docs/concepts">Core concepts</a> — what a project, step, path, and snapshot
		are, and how they relate.
	</li>
</ul>

<h2>What Provar is, in one paragraph</h2>
<p>
	Provar is a Git-native, AI-assisted, local-only end-to-end testing tool. You draw a graph of
	user-facing steps on a visual canvas, the agent writes the underlying browser automation, and
	the result is a YAML test file in your repository that runs the same in the editor, on the
	command line, and in CI. There is no cloud service and no proprietary binary blob — every
	artifact is a file you can read, edit, and review.
</p>

<DocsPlaceholder caption="Editor canvas with a 4-step login test (placeholder)" />

<h2>What you'll need</h2>
<ul>
	<li>A macOS or Linux machine (Windows via WSL is supported; native Windows is not).</li>
	<li>
		<a href="https://bun.sh" target="_blank" rel="noopener">Bun</a> 1.1+ to install and run the
		editor and CLI.
	</li>
	<li>An LLM API key (OpenAI, Anthropic, or a compatible provider).</li>
	<li>A web app to test against — for the quickstart, we ship a sample target so you don't need
		your own yet.</li>
</ul>

<p class="text-on-surface-variant text-sm">
	The full product spec lives at
	<a href="https://github.com/thani-sh/provar/blob/main/docs/PRODUCT.md" target="_blank" rel="noopener"
		><code>docs/PRODUCT.md</code></a
	> in the repository.
</p>
