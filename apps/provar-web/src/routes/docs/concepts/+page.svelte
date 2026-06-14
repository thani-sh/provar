<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Core concepts</h1>
<p>
	Provar models a test as a directed graph of user-facing steps. The graph is stored in
	plain YAML in your repository. These are the words the editor, the CLI, and this guide all
	agree on.
</p>

<h2>The data model in one diagram</h2>
<DocsPlaceholder caption="Diagram of project → test file → graph → path → step (placeholder)" />

<h2>Terms</h2>
<dl>
	<dt><strong>Project</strong></dt>
	<dd>
		A folder containing the application under test and a <code>.provar/</code> directory. A
		project is the root of everything Provar does; the editor opens one project at a time.
	</dd>

	<dt><strong>Test file</strong></dt>
	<dd>
		A YAML file under <code>.provar/tests/</code> that describes one test as a graph. The
		default file is a single graph; you can split a test into multiple files if the user
		journey has distinct phases.
	</dd>

	<dt><strong>Graph</strong></dt>
	<dd>
		The collection of steps, the start step, and the connections between them. A graph with
		branches has multiple <em>paths</em>.
	</dd>

	<dt><strong>Step</strong></dt>
	<dd>
		One user-facing action in a test: open a form, click a button, type text, assert a result.
		Each step has a <code>title</code> (short) and an <code>info</code> (long-form, given to
		the AI).
	</dd>

	<dt><strong>Path</strong></dt>
	<dd>
		A topologically ordered sequence of steps from the start step to a leaf. A linear graph
		has one path; a diamond (branch then rejoin) has two.
	</dd>

	<dt><strong>Snapshot</strong></dt>
	<dd>
		A recorded screenshot of the page state after a step runs. Used for visual diffing. Stored
		as a PNG in <code>.provar/screenshots/</code>.
	</dd>

	<dt><strong>Baseline</strong></dt>
	<dd>
		The snapshot a new run is compared against. Baselines are reviewed and accepted by a human
		before they become the reference.
	</dd>

	<dt><strong>Run</strong></dt>
	<dd>
		One execution of a single path. Multiple runs in sequence are a <em>test run</em>.
	</dd>
</dl>

<h2>What lives where</h2>
<pre><code>my-project/
  package.json
  ...
  .provar/
    config.yml          # project variables (baseUrl, credentials, etc.)
    tests/
      auth/
        login-flow.test.yml
    screenshots/        # baselines live here
</code></pre>

<p class="text-on-surface-variant text-sm">
	Engineering note: the runtime types in the codebase are <code>Task</code>, <code>Graph</code>,
	<code>Path</code>, and <code>File</code> (see <code>libs/domain/src/index.ts</code>). They are
	the same concepts under different names. The user-facing words above are the ones in the
	editor, the CLI, and this guide.
</p>
