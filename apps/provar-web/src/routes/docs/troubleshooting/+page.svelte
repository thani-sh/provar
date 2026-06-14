<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Troubleshooting</h1>
<p>
	The ten most common problems beginners hit on their first run, in the order they tend to come
	up. If you are stuck, search this page first.
</p>

<h2>"The editor is blank when I open it"</h2>
<p>
	You have no project open. The empty state offers <em>Create sample project</em> and
	<em>Open a folder</em>. Pick one.
</p>

<h2>"My API key isn't being accepted"</h2>
<p>
	Open the Settings dialog (Provar → Settings…). Re-paste the key, save, and reopen the test.
	The key is stored at <code>~/.provar/settings.json</code>; you can also check that file
	directly to confirm the save took.
</p>

<DocsPlaceholder caption="Settings dialog with the API key field (placeholder)" />

<h2>"Compile is taking forever"</h2>
<p>
	The first compile of a test is an LLM round-trip and can take 10–30 seconds per step. A
	50-step test takes a few minutes. Subsequent compiles are incremental — only the changed
	steps re-run.
</p>

<h2>"The browser never opens"</h2>
<p>
	Install the Playwright browsers once: <code>bunx playwright install chromium</code>. If the
	editor still cannot find them, set the <code>PLAYWRIGHT_BROWSERS_PATH</code> environment
	variable to the install location.
</p>

<h2>"My step passed visually but failed the snapshot diff"</h2>
<p>
	The page rendered slightly differently — a different timestamp, an ad, an animation frame. The
	editor's run panel shows the diff. If the change is acceptable, click <em>Accept new
	snapshot</em> to promote it to the baseline.
</p>

<h2>"The editor crashes when I switch files"</h2>
<p>
	Known issue with the file-switch screenshot race (see
	<code>docs/TODOS.md</code> T010). Saving the file and reopening it works around the issue. The
	fix is queued for the next release.
</p>

<h2>"I typo'd a CLI subcommand and the command exited 0"</h2>
<p>
	Fixed in the current build: unknown subcommands now exit 2 with a helpful message. If you are
	on an older build, update and try again.
</p>

<h2>"Tests pass locally but fail in CI"</h2>
<p>
	Most often: missing Playwright browsers (run <code>bunx playwright install</code>) or missing
	API key (set it as a CI secret, not in the repository).
</p>

<h2>"I want to undo accepting a baseline"</h2>
<p>
	Baselines are PNG files in <code>.provar/screenshots/</code>. Git revert, then re-run.
</p>

<h2>"Where do I report a bug?"</h2>
<p>
	<a href="https://github.com/thani-sh/provar/issues" target="_blank" rel="noopener"
		>github.com/thani-sh/provar/issues</a
	>. Include the editor version (Provar → About), the test file, and the failing run's output.
</p>
