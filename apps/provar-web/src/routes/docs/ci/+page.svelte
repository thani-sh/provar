<script>
	import { buildInfo } from "$lib/build-info";

	// Build the GitHub Actions YAML in JS so the Svelte template parser does not interpret
	// the `${{ secrets.X }}` and `$VAR` sequences. See STYLE.md § 2.
	const secretsYaml = `- name: Write Provar settings
  env:
    PROVAR_OPENAI_KEY: \${{ secrets.OPENAI_API_KEY }}
  run: |
    mkdir -p ~/.provar
    cat > ~/.provar/settings.yml <<EOF
    models:
      provider: openai
      providers:
        openai:
          model: gpt-5.5
          apiKey: \$PROVAR_OPENAI_KEY
        google:
          model: gemini-3.5-flash
        anthropic:
          model: claude-5-sonnet-latest
    EOF`;
</script>

<h1>CI integration</h1>
<p>
	Provar runs the same in CI as on your machine. Install the CLI, point it at your tests,
	read the exit code. The CLI exits with the documented codes (0 / 1 / 2 / 130 from
	<a href="/docs/running">Running tests</a>), so any CI system can report failures correctly
	without any Provar-specific glue.
</p>

<h2>provar-cli configuration</h2>
<p>
	The product-shaped details (install pattern, environment variables, job shape, caching)
	live on the <a href="/docs/products/provar-cli">provar-cli page</a>. This page covers the
	same ground from a CI-systems perspective — how to wire the CLI into GitHub Actions, GitLab
	CI, and other systems in a portable way.
</p>
<p>
	Quick reference: install the CLI (one-line curl on macOS / Linux, raw binary on Windows),
	the only secret you need is the LLM provider API key (write it into
	<code>~/.provar/settings.yml</code> before invoking the CLI), and the canonical run command
	is <code>provar run .</code>.
</p>

<h2>GitHub Actions</h2>
<pre><code>- name: Install provar CLI
  run: curl -fsSL {buildInfo.url}/install.sh | bash

- name: Run provar tests
  run: prover run .</code></pre>

<h2>GitLab CI</h2>
<p>
	Same job, expressed as a <code>.gitlab-ci.yml</code> entry. The curl installer works on
	Linux runners directly. Otherwise, pull the binary from the
	<a href="https://github.com/thani-sh/provar/releases" target="_blank" rel="noopener"
		>GitHub releases page</a
	>
	and put it on <code>PATH</code>.
</p>

<h2>Secrets</h2>
<p>
	The LLM API key is the only secret Provar needs. The CLI reads it from
	<code>~/.provar/settings.yml</code> at compile time — pass it as a CI secret and write it
	into the file in a pre-step:
</p>
<pre><code>{secretsYaml}</code></pre>
<p>
	One thing to be careful about: never commit the key to the repo, and don't put it in
	<code>.provar/config.yml</code> — config files get diffed in pull requests. CI secrets are
	the right home.
</p>
<p class="text-on-surface-variant text-sm">
	The compile step is the only step that touches the LLM. The <code>run</code> step is purely
	local — no API key needed at run time.
</p>
