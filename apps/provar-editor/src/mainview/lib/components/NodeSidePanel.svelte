<script lang="ts">
	import type { TestNode } from '../../../shared/domain';
	import { Check, Image, Share2, Trash2 } from 'lucide-svelte';
	import { getCodeStatus } from '../../../shared/utils';

	let { 
		node, 
		nodeId, 
		onUpdate,
		onDelete
	}: { 
		node: TestNode; 
		nodeId: string;
		onUpdate: (id: string, updates: Partial<TestNode>) => void;
		onDelete: (id: string) => void;
	} = $props();

	const codeStatus = $derived(getCodeStatus(node));
	const hasSubGraph = $derived(!!node.graph);

	function handleTitleChange(e: Event) {
		const title = (e.target as HTMLInputElement).value;
		onUpdate(nodeId, { title });
	}

	function handleInfoChange(e: Event) {
		const info = (e.target as HTMLTextAreaElement).value;
		onUpdate(nodeId, { info });
	}
</script>

<aside
	class="absolute top-8 right-2 bottom-2 z-50 flex w-[400px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
>
	<div class="flex flex-col border-b border-zinc-800/50 p-6">
		<input
			type="text"
			value={node.title}
			oninput={handleTitleChange}
			class="mb-2 bg-transparent text-xl font-medium text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500/50 rounded px-1 -ml-1"
		/>
		<textarea
			value={node.info}
			oninput={handleInfoChange}
			rows="3"
			class="resize-none bg-transparent text-sm leading-relaxed text-zinc-400 outline-none focus:ring-1 focus:ring-indigo-500/50 rounded px-1 -ml-1"
		></textarea>
	</div>

	<div class="flex-1 space-y-8 overflow-y-auto p-6">
		<section>
			<h3 class="mb-3 text-sm font-medium tracking-wider text-zinc-400 uppercase">Actions</h3>
			<button
				onclick={() => onDelete(nodeId)}
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
			>
				<Trash2 size={16} />
				Delete Node Branch
			</button>
		</section>

		{#if node.asserts && Object.keys(node.asserts).length > 0}
			<section>
				<h3
					class="mb-3 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase"
				>
					<Check size={14} class="text-emerald-500" />
					Assertions
				</h3>
				<div class="space-y-3">
					{#each Object.entries(node.asserts) as [, assertion]}
						<div class="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
							<h4 class="mb-1 text-sm font-medium text-zinc-200">{assertion.title}</h4>
							<p class="text-sm text-zinc-400">{assertion.info}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h3 class="mb-3 text-sm font-medium tracking-wider text-zinc-400 uppercase">Code Status</h3>
			<div
				class="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4"
			>
				<span class="text-sm text-zinc-300">Generated Code</span>
				{#if codeStatus === 'upToDate'}
					<span
						class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400"
						>Up to date</span
					>
				{:else if codeStatus === 'outdated'}
					<span
						class="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400"
						>Outdated</span
					>
				{:else}
					<button
						class="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-600"
						>Generate</button
					>
				{/if}
			</div>
		</section>

		<section>
			<h3
				class="mb-3 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase"
			>
				Post-Execution Screenshot
			</h3>
			<div
				class="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-zinc-500"
			>
				<Image size={24} class="mb-2 opacity-50" />
				<span class="text-sm">No screenshot available</span>
			</div>
		</section>

		{#if hasSubGraph}
			<section class="pb-8">
				<div class="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-5">
					<div class="mb-3 flex items-center gap-3">
						<div class="rounded-lg bg-indigo-500/20 p-2 text-indigo-400">
							<Share2 size={18} />
						</div>
						<div>
							<h3 class="text-sm font-medium text-zinc-200">Contains Sub-Graph</h3>
							<p class="mt-0.5 text-xs text-zinc-400">
								This action acts as a container for detailed steps.
							</p>
						</div>
					</div>
					<button
						class="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
					>
						View Sub-Graph
					</button>
				</div>
			</section>
		{/if}
	</div>
</aside>
