<script lang="ts">
  import { untrack } from "svelte";
  import type { ProvarConfig } from "@libs/domain/zod";

  let {
    config,
    onSave,
  }: {
    config: ProvarConfig | null;
    onSave: (config: ProvarConfig) => void;
  } = $props();

  const initialConfig = untrack(() => $state.snapshot(config));
  let variablesJson = $state(
    JSON.stringify(initialConfig?.variables || {}, null, 2),
  );
  let jsonError = $state<string | null>(null);

  $effect(() => {
    let variablesObj = {};
    try {
      variablesObj = JSON.parse(variablesJson);
      jsonError = null;
    } catch (e) {
      jsonError = (e as Error).message;
      return;
    }

    const hasVariablesChanged =
      JSON.stringify(variablesObj) !== JSON.stringify(config?.variables || {});

    if (config && !hasVariablesChanged) {
      return;
    }

    onSave({
      ...config,
      variables: variablesObj,
    });
  });
</script>

<div class="flex h-full w-full flex-col">
  <div
    class="flex items-center justify-between border-b border-zinc-800/50 px-6 pt-3 pb-4"
  >
    <h2 class="text-sm font-semibold text-zinc-200">Project Settings</h2>
  </div>

  <div class="flex-1 space-y-8 overflow-y-auto p-6">
    <section>
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-xs font-medium tracking-wider text-zinc-500 uppercase">
          Variables
        </h3>
      </div>

      <div class="space-y-3">
        <div class="relative">
          <textarea
            bind:value={variablesJson}
            placeholder={'{ "key": "value" }'}
            spellcheck="false"
            class="h-48 w-full rounded-lg border border-zinc-700/50 bg-[#0d1117] p-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none {jsonError
              ? 'border-red-500/50 ring-1 ring-red-500/20'
              : ''}"
          ></textarea>

          {#if jsonError}
            <div
              class="mt-2 font-mono text-[10px] leading-tight text-red-400/80"
            >
              {jsonError}
            </div>
          {/if}
        </div>
      </div>
    </section>
  </div>
</div>
