<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";

	// Build the GitHub Actions YAML in JS so the Svelte template parser does not interpret
	// the `${` in the `${{ secrets.OPENAI_API_KEY }}` expression. See STYLE.md § 2.
	const ghaYaml = `name: provar
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.1
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - name: Run provar tests
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: bun --cwd apps/provar-cli -- run .
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: provar-failures
          path: .provar/screenshots/`;
</script>

<h1>CI integration</h1>
<p>
	Provar runs the same in CI as on your machine. Install Bun, install Playwright browsers, and
	invoke the CLI. The CLI exits with documented codes (0 / 1 / 2 / 130) so any CI system can
	report failures correctly.
</p>

<h2>GitHub Actions</h2>
<pre><code>{ghaYaml}</code></pre>

<DocsPlaceholder caption="GitHub Actions run log with the provar step highlighted (placeholder)" />

<h2>GitLab CI</h2>
<p>
	The same job, expressed as a <code>.gitlab-ci.yml</code> job, runs against the
	<code>provar:&lt;taskId&gt;</code> image once it ships. For now, install Bun in the job image
	with the official installer and follow the same step ordering.
</p>

<h2>Caching</h2>
<p>
	Cache the Playwright browser bundle between runs. On GitHub Actions, the
	<code>actions/cache</code> step keyed on the Playwright revision is enough.
</p>

<h2>Secrets</h2>
<p>
	The LLM API key is the only secret Provar needs. Pass it as an environment variable
	(<code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, etc.) and the editor will pick
	it up; no Provar-specific configuration is required.
</p>
