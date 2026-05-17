<script lang="ts">
	import type { ProvarConfig } from '../../shared/domain';

	interface Props {
		show: boolean;
		onConfirm: (config: ProvarConfig) => void;
	}

	let { show, onConfirm } = $props<Props>();

	let providerType = $state<'local' | 'remote'>('local');
	let providerName = $state('gemini-cli');

	function handleConfirm() {
		onConfirm({
			provider: {
				type: providerType,
				name: providerName
			}
		});
	}
</script>

{#if show}
	<div class="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
		<div class="w-[450px] rounded-2xl border border-zinc-800 bg-[#161b22] p-8 shadow-2xl">
			<p class="mb-8 text-sm text-zinc-400">
				Let's set up your project configuration to get started.
			</p>

			<div class="space-y-6">
				<div>
					<label
						for="provider-type"
						class="mb-2 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
					>
						Provider Type
					</label>
					<select
						id="provider-type"
						bind:value={providerType}
						onchange={() => {
							if (providerType === 'local') {
								providerName = 'gemini-cli';
							} else {
								providerName = 'openai';
							}
						}}
						class="w-full appearance-none rounded-lg border border-zinc-700/50 bg-[#21262d] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_1rem_center] bg-no-repeat px-4 py-3.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
					>
						<option value="local">Local</option>
						<option value="remote">Remote</option>
					</select>
				</div>

				<div>
					<label
						for="provider-name"
						class="mb-2 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
					>
						AI Provider
					</label>
					<select
						id="provider-name"
						bind:value={providerName}
						class="w-full appearance-none rounded-lg border border-zinc-700/50 bg-[#21262d] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_1rem_center] bg-no-repeat px-4 py-3.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
					>
						{#if providerType === 'local'}
							<option value="gemini-cli">Gemini CLI</option>
							<option value="copilot-cli">Copilot CLI</option>
						{:else}
							<option value="openai">OpenAI</option>
							<option value="anthropic">Anthropic</option>
						{/if}
					</select>
				</div>
			</div>

			<div class="mt-10">
				<button
					class="w-full rounded-lg bg-indigo-500 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-600 active:scale-[0.98]"
					onclick={handleConfirm}
				>
					Initialize Project
				</button>
			</div>
		</div>
	</div>
{/if}
