<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Authoring tests</h1>
<p>
	Authoring a test in Provar is a back-and-forth between you and the agent. You set the intent
	(the step's <code>title</code> and <code>info</code>); the agent writes the underlying
	Playwright code. You review the diff; the agent regenerates on demand.
</p>

<h2>Creating a new test</h2>
<p>
	From the editor's Test Explorer, click <strong>+</strong> and choose a parent directory. The
	new test is an empty graph with a single start step. Edit the step's title and info in the
	right sidebar.
</p>

<DocsPlaceholder caption="Test Explorer with the new-test button highlighted (placeholder)" />

<h2>Adding steps</h2>
<p>
	Click a node on the canvas, then drag from its <em>next</em> handle to an empty area. The
	editor creates a new step and wires the connection.
</p>

<h2>Adding a branch</h2>
<p>
	Drag from a node's <em>next</em> handle to an existing node. The editor creates a branch;
	both branches execute when the test runs.
</p>

<h2>Regenerating the underlying code</h2>
<p>
	The right sidebar's <strong>Regenerate</strong> button sends the step's title and info to the
	agent with the current page state. The agent returns new Playwright code; the editor shows a
	diff and lets you accept or edit.
</p>

<p class="text-on-surface-variant text-sm">
	Full authoring reference (YAML schema, supported step types, AI provider setup) is coming
	next. The shape of the YAML is the same as the bundled sample — see
	<code>apps/provar-app/sample-projects/todo-app/.provar/tests/auth/login-flow.test.yml</code>.
</p>
