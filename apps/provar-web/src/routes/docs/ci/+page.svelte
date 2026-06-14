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
	Provar runs the same in CI as on your machine. Install Bun, install Playwright browsers,
	invoke the CLI. The CLI exits with the documented codes (0 / 1 / 2 / 130 from
	<a href="/docs/running">Running tests</a>), so any CI system can report failures correctly
	without any Provar-specific glue.
</p>

<h2>provar-cli configuration</h2>
<p>
	The product-shaped details (install pattern, environment variables, job shape, caching)
	live on the
	<a href="/docs/products/provar-cli">provar-cli page</a>. This page covers the same ground
	from a CI-systems perspective — how to wire the CLI into GitHub Actions, GitLab CI, and
	other systems in a portable way.
</p>
<p>
	Quick reference: the minimal install is <code>bun install</code> +
	<code>bunx playwright install --with-deps chromium</code>, the only secret you need is
	<code>OPENAI_API_KEY</code> (or its sibling for your provider), and the canonical run
	command is <code>bun --cwd apps/provar-cli -- run .</code>.
</p>

<h2>GitHub Actions</h2>
<pre><code>{ghaYaml}</code></pre>

<DocsPlaceholder caption="GitHub Actions run log with the provar step highlighted (placeholder)" />

<h2>GitLab CI</h2>
<p>
	Same job, expressed as a <code>.gitlab-ci.yml</code> entry. Once the
	<code>provar:&lt;taskId&gt;</code> image ships, you can use it directly. Until then, install
	Bun in the job image with the official installer and follow the same step order — it works
	identically.
</p>

<h2>Caching</h2>
<p>
	Cache the Playwright browser bundle between runs. On GitHub Actions, the
	<code>actions/cache</code> step keyed on the Playwright revision is enough. On GitLab, the
	built-in <code>cache:</code> key on the same path works just as well. Without this, every
	job pays the 30-second browser install tax.
</p>

<h2>Secrets</h2>
<p>
	The LLM API key is the only secret Provar needs. Pass it as an environment variable
	(<code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, or any OpenAI-shape endpoint)
	and the CLI picks it up. No Provar-specific configuration, no vendor SDK, no nothing.
</p>
<p>
	One thing to be careful about: never commit the key to the repo, and don't put it in
	<code>.provar/config.yml</code> — config files get diffed in pull requests. CI secrets are
	the right home.
</p>
