<script lang="ts">
  import type { ProvarConfig } from '../../shared/domain';

  interface Props {
    show: boolean;
    onConfirm: (config: ProvarConfig) => void;
  }

  let { show, onConfirm } = $props<Props>();

  let providerType = $state('copilot-cli');
  let model = $state('gpt-5.4-mini');

  function handleConfirm() {
    onConfirm({
      provider: {
        type: providerType,
        model: model
      }
    });
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
    <div class="w-[450px] rounded-2xl border border-zinc-800 bg-[#161b22] p-8 shadow-2xl">
      <h2 class="mb-2 text-2xl font-semibold text-zinc-100">Welcome to Provar</h2>
      <p class="mb-8 text-sm text-zinc-400">Let's set up your project configuration to get started.</p>
      
      <div class="space-y-6">
        <div>
          <label for="provider-type" class="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            AI Provider
          </label>
          <select
            id="provider-type"
            bind:value={providerType}
            class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="copilot-cli">Copilot CLI</option>
          </select>
        </div>

        <div>
          <label for="model" class="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Model
          </label>
          <input
            id="model"
            type="text"
            bind:value={model}
            placeholder="e.g. gpt-5.4-mini"
            class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
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
