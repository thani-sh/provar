<script lang="ts">
	import { Sparkles, File, User, Bot } from 'lucide-svelte';

	export type AssistantMessage = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		status?: 'pending' | 'completed' | 'error';
	};

	let {
		onSend,
		selectedFile = null,
		messages = [],
		isBusy = false
	}: {
		onSend: (message: string) => void;
		selectedFile?: string | null;
		messages?: AssistantMessage[];
		isBusy?: boolean;
	} = $props();

	let message = $state('');
	let fileName = $derived(selectedFile?.split('/').pop());
	let textarea: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (textarea) {
			textarea.focus();
		}
	});

	function handleSend() {
		if (!message.trim() || isBusy) return;
		onSend(message);
		message = '';
	}
</script>

<aside
	class="absolute top-8 right-2 bottom-2 z-50 flex w-[400px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
>
	<div class="flex items-center justify-between border-b border-zinc-800/50 p-6">
		<div class="flex items-center gap-2">
			<Sparkles size={20} class="text-indigo-400" />
			<h2 class="text-xl font-medium text-zinc-100">AI Assistant</h2>
		</div>
	</div>

	<div class="flex-1 space-y-6 overflow-y-auto p-6">
		{#if messages.length === 0}
			<div class="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
				<p class="text-sm leading-relaxed text-zinc-300">
					I'm here to help you build and refine your tests. You can ask me to:
				</p>
				<ul class="mt-3 list-inside list-disc space-y-2 text-xs text-zinc-400">
					<li>Generate new test steps based on a description</li>
					<li>Refactor existing test flows</li>
					<li>Add assertions to your nodes</li>
					<li>Explain how a test works</li>
				</ul>
				<p class="mt-4 border-t border-zinc-800/50 pt-3 text-[11px] text-zinc-500 italic">
					Tip: You can use the assistant with or without a selected file. When a file is open, it
					will be used as context for your requests.
				</p>
			</div>
		{:else}
			{#each messages as msg}
				<div class="flex gap-3 {msg.role === 'user' ? 'flex-row-reverse' : ''}">
					<div
						class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-[#21262d]"
					>
						{#if msg.role === 'user'}
							<User size={16} class="text-zinc-400" />
						{:else}
							<Bot size={16} class="text-indigo-400" />
						{/if}
					</div>
					<div class="flex flex-col gap-1 {msg.role === 'user' ? 'items-end' : ''}">
						<div
							class="rounded-2xl px-4 py-2 text-sm leading-relaxed {msg.role === 'user'
								? 'bg-indigo-600 text-white'
								: 'bg-zinc-800/50 text-zinc-200'}"
						>
							{#if msg.role === 'assistant' && msg.status === 'pending'}
								<span class="text-zinc-400 italic">Thinking...</span>
							{:else}
								{msg.content}
							{/if}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div class="border-t border-zinc-800/50 p-4">
		{#if fileName}
			<div class="mb-2 flex items-center px-1">
				<div
					class="flex items-center gap-1 rounded-full border border-zinc-700/50 bg-[#21262d] py-0.5 pr-2 pl-1.5 text-[10px] text-zinc-400"
				>
					<File size={10} class="text-zinc-500" />
					<span class="max-w-[150px] truncate">{fileName}</span>
				</div>
			</div>
		{/if}
		<div class="relative">
			<textarea
				bind:this={textarea}
				bind:value={message}
				placeholder="Type your request here..."
				class="min-h-[100px] w-full resize-none rounded-lg border border-zinc-700/50 bg-[#0d1117] p-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none {isBusy
					? 'cursor-not-allowed opacity-50'
					: ''}"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey && !isBusy) {
						e.preventDefault();
						handleSend();
					} else if (e.key === 'Enter' && !e.shiftKey && isBusy) {
						e.preventDefault();
					}
				}}
			></textarea>
		</div>
		<p class="mt-2 text-center text-[10px] text-zinc-500">
			AI can make mistakes. Check important info.
		</p>
	</div>
</aside>
