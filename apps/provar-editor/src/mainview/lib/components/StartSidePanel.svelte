<script lang="ts">
	import { Info, Code, FileJson } from 'lucide-svelte';

	let {
		title = 'Start Node',
		info = 'This is the entry point of the test graph. It defines the initial state and parameters for the test execution.',
		config = {}
	}: { title?: string; info?: string; config?: any } = $props();

	const configJson = $derived(JSON.stringify(config, null, 2));
</script>

<aside
	class="absolute top-8 right-2 bottom-2 z-50 flex w-[400px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
>
	<div class="flex items-start justify-between border-b border-zinc-800/50 p-6">
		<div class="flex flex-col pr-4">
			<h2 class="mb-2 text-xl font-medium text-zinc-100">{title}</h2>
			<p class="text-sm leading-relaxed text-zinc-400">{info}</p>
		</div>
	</div>

	<div class="flex-1 space-y-8 overflow-y-auto p-6">
		<section>
			<h3
				class="mb-3 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase"
			>
				<Info size={14} class="text-indigo-400" />
				Context
			</h3>
			<div class="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
				<p class="text-sm leading-relaxed text-zinc-300">
					The start node initializes the test sequence. Any global variables, authentication states,
					or environment configurations are established here before the first action is executed.
				</p>
			</div>
		</section>

		<section>
			<h3
				class="mb-3 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase"
			>
				<FileJson size={14} class="text-amber-400" />
				Configuration
			</h3>
			<div class="relative group">
				<pre
					class="overflow-x-auto rounded-xl border border-zinc-800/50 bg-black/40 p-4 font-mono text-xs text-zinc-400 leading-relaxed shadow-inner"
				><code>{configJson}</code></pre>
				<div class="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
					<span class="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-500 uppercase">JSON</span>
				</div>
			</div>
		</section>

		<section class="pb-8">
			<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
				<div class="flex gap-3">
					<div class="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 h-fit">
						<Code size={18} />
					</div>
					<div>
						<h3 class="text-sm font-medium text-zinc-200">Pro-Tip</h3>
						<p class="mt-1 text-xs text-zinc-400 leading-relaxed">
							You can customize the initial parameters in your <code class="text-emerald-300">test.yaml</code>
							to change how this graph behaves across different environments.
						</p>
					</div>
				</div>
			</div>
		</section>
	</div>
</aside>
