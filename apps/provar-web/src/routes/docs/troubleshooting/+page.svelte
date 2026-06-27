<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Troubleshooting</h1>
<p>
	The ten most common ways a first run goes sideways, in roughly the order they tend to come
	up. If you're stuck, scan this page before opening an issue — odds are good your exact
	problem is one of these.
</p>

<h2>"The editor opens to a blank screen"</h2>
<p>
	You don't have a project open yet. The empty state shows two cards: <em>Create sample
	project</em> and <em>Open a folder</em>. Pick one. (If neither card is showing, you're on
	the wrong screen — the editor's window title should say <code>Provar</code> with no project
	name.)</p>

<h2>"My API key isn't being accepted"</h2>
<p>
	Open the Settings dialog (Provar → Settings…). Re-paste the key, hit save, close the
	dialog, reopen the test. The key is stored at <code>~/.provar/settings.json</code>; you can
	also <code>cat</code> that file to confirm the save actually took. (If the file doesn't
	exist, the editor hasn't written anything yet.)</p>

<DocsPlaceholder caption="Settings dialog with the API key field (placeholder)" />

<h2>"Compile is taking forever"</h2>
<p>
	The first compile of a step is an LLM round-trip — figure on 10–30 seconds per step. A
	50-step test takes a few minutes. This is normal. Subsequent compiles are incremental: only
	the steps you've actually changed re-run. So if you regenerate one step, you're waiting 15
	seconds, not ten minutes.
</p>

<h2>"The browser never opens"</h2>
<p>
	Install the Playwright browsers once: <code>bunx playwright install chromium</code>. If the
	editor still can't find them, set the <code>PLAYWRIGHT_BROWSERS_PATH</code> environment
	variable to the install location and restart. (On macOS the default location is buried deep
	in your home directory, which is why the env var exists.)</p>

<h2>"My step passed visually but failed the snapshot diff"</h2>
<p>
	The page rendered slightly differently than last time — a different timestamp, a stray ad,
	an animation frame caught mid-fade. The editor's run panel shows the diff side-by-side. If
	the change is fine, click <em>Accept new snapshot</em> and the new image becomes the
	baseline. If it isn't, regenerate the step.</p>

<h2>"The editor crashes when I switch files"</h2>
<p>
	Known issue with the file-switch screenshot race (see <code>docs/TODOS.md</code> T010). The
	workaround is to save the file and reopen it. The fix is queued for the next release — we
	know about it, and we're sorry it's annoying.
</p>

<h2>"I typo'd a CLI subcommand and the command exited 0"</h2>
<p>
	Fixed in the current build: unknown subcommands now exit 2 with a helpful message that
	includes the typo and the closest match. If you're on an older build, <code>git pull</code>
	and try again.
</p>

<h2>"Tests pass locally but fail in CI"</h2>
<p>
	Nine times out of ten it's one of two things. Missing Playwright browsers — run
	<code>bunx playwright install</code> in the job. Missing API key — set it as a CI secret
	and pass it as <code>OPENAI_API_KEY</code>, not as a literal in the workflow file. The CI
	page has the full recipe.
</p>

<h2>"I want to undo accepting a baseline"</h2>
<p>
	Baselines are PNG files in <code>.provar/screenshots/</code>. <code>git revert</code> the
	ones you want to roll back, re-run, and accept the right snapshot. Same as reverting any
	other tracked file — that's the whole point of storing baselines in git.
</p>

<h2>"Where do I report a bug?"</h2>
<p>
	<a href="https://github.com/thani-sh/provar/issues" target="_blank" rel="noopener"
		>github.com/thani-sh/provar/issues</a
	>. Include the editor version (Provar → About), the test file, and the failing run's
	output. Screenshots of the run panel help too. We read everything; the more context the
	better.</p>
