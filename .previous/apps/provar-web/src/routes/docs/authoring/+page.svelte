<script>
	import DocsPlaceholder from "$lib/components/docs-placeholder.svelte";
</script>

<h1>Authoring tests</h1>
<p>
	Writing a test in Provar is a back-and-forth between you and the agent. You write down what
	the step <em>should</em> do — its <code>title</code> and <code>info</code> — and the agent
	writes the actual Playwright code that makes it happen. You review the diff, hit accept or
	edit, and the agent regenerates on demand. It's a loop, not a one-shot.
</p>

<h2>Creating a new test</h2>
<p>
	From the editor's Test Explorer, click <strong>+</strong> and pick a parent directory. You
	get a new test file with a single empty graph and a start step. Click the start step and
	edit the title and info in the right sidebar — that's your new step, ready to go.
</p>

<DocsPlaceholder caption="Test Explorer with the new-test button highlighted (placeholder)" />

<h2>Adding steps</h2>
<p>
	Click a node on the canvas, then drag from its <em>next</em> handle to an empty area. A new
	step appears, the connection is wired, and you're ready to fill in the title and info. If
	you've ever used a flow chart tool, you already know the gesture.
</p>

<h2>Adding a branch</h2>
<p>
	Same gesture, different target. Drag from a node's <em>next</em> handle to an <em>existing</em>
	node instead of empty space. A branch is born; both branches will run when the test
	executes. Use this when the user journey genuinely forks — "user is signed in" vs "user is
	signed out", say.
</p>

<h2>Regenerating the underlying code</h2>
<p>
	The right sidebar has a <strong>Regenerate</strong> button. Click it and the step's title,
	info, and the current page state get sent to the agent. The agent returns new Playwright
	code; the editor shows a diff; you accept, edit, or reject. The accepted version becomes the
	code for that step, and the snapshot is recorded when the step next runs.
</p>
<p>
	You'll do this a lot. It's the core loop. After a while you'll forget the old way of writing
	tests by hand, which is the point.
</p>

<p class="text-on-surface-variant text-sm">
	The full authoring reference (YAML schema, supported step types, AI provider setup) is
	coming next. The shape of the YAML matches the bundled sample — see
	<code>apps/provar-app/sample-projects/todo-app/.provar/tests/auth/login-flow.test.yml</code>
	for the canonical example.
</p>
