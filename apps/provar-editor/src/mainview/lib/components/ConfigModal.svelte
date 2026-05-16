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
      <p class="mb-8 text-sm text-zinc-400">Let's set up your project configuration to get started.</p>

      <div class="space-y-6">
        <div>
          <label for="provider-type" class="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
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
            class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="local">Local</option>
            <option value="remote">Remote</option>
          </select>
        </div>

        <div>
          <label for="provider-name" class="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            AI Provider
          </label>
          <select
            id="provider-name"
            bind:value={providerName}
            class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
