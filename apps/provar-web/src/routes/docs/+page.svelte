<script lang="ts">
	type CoreConcept = {
		title: string;
		summary: string;
		detail: string;
	};

	const concepts: CoreConcept[] = [
		{
			title: "Project",
			summary: "Your app, your tests, one folder.",
			detail:
				"A folder with your application and a .provar/ directory inside. Everything Provar cares about lives there — your test files, the snapshots, the AI-generated scripts, the config. Outside that folder Provar doesn't look. That means no separate workspace, no cloud sync, no 'Provar account' — your tests are just files in your repo, reviewable in pull requests alongside the rest of the change."
		},
		{
			title: "Test graph",
			summary: "A graph of user actions, with branches.",
			detail:
				"A YAML file that describes one test as a graph of user-facing steps. A step is one action — open a page, click a button, type text, assert a result. The graph says which steps lead to which; a branching journey (signed-in vs signed-out, free vs paid) is just two paths in the same graph. You author the graph; the AI never edits it, only the code that runs each step."
		},
		{
			title: "Generated code",
			summary: "AI-written code. Runs without one.",
			detail:
				"The machine-friendly code the AI writes from your graph, sitting in your project as a regular file — reviewable, diffable, runnable on its own. The AI writes it once when the step is first added; after that it's just code. CI runs the script with no LLM in the loop. You only need an API key at author-time, not at run-time. That separation is what makes 'AI-assisted' not 'AI-dependent.'"
		}
	];

	let selected = $state(0);
</script>

<h1>Provar docs</h1>
<p>
	Welcome. If you've just installed the editor, jump to the
	<a href="/docs/quickstart">quickstart</a> — you can have a passing test in about five
	minutes, which is roughly the time it takes to read this paragraph and find a coffee.
</p>
<p>
	This guide exists for the rest of the time: when you've forgotten a detail, hit a weird edge
	case, or want to understand <em>why</em> something is the way it is. Read it top to bottom on
	day one, then keep it open in a tab for the inevitable "wait, how do I…".
</p>

<h2>Core concepts</h2>
<p>Three ideas, and once you have them the rest of the tool is just buttons.</p>
<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
	{#each concepts as concept, i (concept.title)}
		{@const active = i === selected}
		<button
			type="button"
			onclick={() => (selected = i)}
			aria-pressed={active}
			class="flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-colors {active
				? 'border-primary bg-surface-container'
				: 'border-outline-variant/60 bg-surface-container-low hover:border-primary/60'}"
		>
			<p class="text-on-surface text-sm font-semibold">{concept.title}</p>
			<p class="text-on-surface-variant text-xs leading-snug">{concept.summary}</p>
		</button>
	{/each}
</div>

{#key selected}
	<p class="text-on-surface-variant mt-3 text-sm leading-relaxed">
		{concepts[selected].detail}
	</p>
{/key}

<h2 class="!border-t-0 !pt-0">Products</h2>
<p>
	Provar ships as two artifacts. They're meant to be used together, but they have very
	different shapes — so they get their own quickstart and their own system requirements. Pick
	the one that matches how you work.
</p>

<div class="grid gap-4 sm:grid-cols-2">
	<a
		href="/docs/products/provar-app"
		class="group border-outline-variant/60 bg-surface-container-low hover:border-primary/60 flex flex-col gap-2 rounded-xl border p-5 transition-colors"
	>
		<div class="flex items-center justify-between">
			<span class="text-on-surface font-mono text-sm font-semibold">
				<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span
				><span class="text-on-surface-variant">app</span>
			</span>
			<span
				class="text-on-surface-variant group-hover:text-primary text-sm transition-colors"
				aria-hidden="true">→</span
			>
		</div>
		<p class="text-on-surface text-sm font-semibold">The desktop editor</p>
		<p class="text-on-surface-variant text-xs leading-relaxed">
			Visual canvas, click to add nodes (the editor auto-lays them out), live snapshot
			review. Built on Electrobun — friendlier to use all day.
		</p>
	</a>
	<a
		href="/docs/products/provar-cli"
		class="group border-outline-variant/60 bg-surface-container-low hover:border-primary/60 flex flex-col gap-2 rounded-xl border p-5 transition-colors"
	>
		<div class="flex items-center justify-between">
			<span class="text-on-surface font-mono text-sm font-semibold">
				<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span
				><span class="text-on-surface-variant">cli</span>
			</span>
			<span
				class="text-on-surface-variant group-hover:text-primary text-sm transition-colors"
				aria-hidden="true">→</span
			>
		</div>
		<p class="text-on-surface text-sm font-semibold">The command-line interface</p>
		<p class="text-on-surface-variant text-xs leading-relaxed">
			Compile and run <code>.test.yml</code> files from a terminal. Tiny surface, runs
			anywhere a static Go binary runs — including CI, including a 1-vps side project.
		</p>
	</a>
</div>
