<script lang="ts">
  import { Settings, Save } from 'lucide-svelte';
  import type { ProvarConfig } from '../../../shared/domain';

  let {
    config,
    onSave
  }: {
    config: ProvarConfig | null;
    onSave: (config: ProvarConfig) => void;
  } = $props();

  let providerType = $state<'local' | 'remote'>(config?.provider.type || 'local');
  let providerName = $state(config?.provider.name || 'gemini-cli');

  function handleSave() {
    onSave({
      provider: {
        type: providerType,
        name: providerName
      }
    });
  }
</script>

<aside
	class="absolute top-8 right-2 bottom-2 z-50 flex w-[400px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
>
	<div class="flex items-center justify-between border-b border-zinc-800/50 p-6">
		<div class="flex items-center gap-2">
			<Settings size={20} class="text-indigo-400" />
			<h2 class="text-xl font-medium text-zinc-100">Project Settings</h2>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6 space-y-8">
    <section>
      <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
        AI Configuration
      </h3>

      <div class="space-y-6">
        <div>
          <label for="panel-provider-type" class="mb-2 block text-xs text-zinc-400">
            Provider Type
          </label>
          <select
            id="panel-provider-type"
            bind:value={providerType}
            onchange={() => {
              if (providerType === 'local') {
                providerName = 'gemini-cli';
              } else {
                providerName = 'openai';
              }
            }}
            class="w-full rounded-lg border border-zinc-700/50 bg-[#0d1117] p-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="local">Local</option>
            <option value="remote">Remote</option>
          </select>
        </div>

        <div>
          <label for="panel-provider-name" class="mb-2 block text-xs text-zinc-400">
            AI Provider
          </label>
          <select
            id="panel-provider-name"
            bind:value={providerName}
            class="w-full rounded-lg border border-zinc-700/50 bg-[#0d1117] p-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
    </section>

    <div class="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
      <p class="text-xs leading-relaxed text-zinc-400">
        Settings are saved to <code class="text-indigo-300">.provar/config.yml</code>.
      </p>
    </div>
	</div>

  <div class="p-4 border-t border-zinc-800/50">
    <button
      onclick={handleSave}
      class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-600 active:scale-[0.98]"
    >
      <Save size={16} />
      Save Configuration
    </button>
  </div>
</aside>
