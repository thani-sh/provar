<script lang="ts">
  import { Settings } from "lucide-svelte";
  import { untrack } from "svelte";
  import type { ProvarConfig } from "../../../../shared/domain";

  let {
    config,
    onSave,
  }: {
    config: ProvarConfig | null;
    onSave: (config: ProvarConfig) => void;
  } = $props();

  const initialConfig = untrack(() => $state.snapshot(config));
  let providerType = $state<"local" | "remote">(
    initialConfig?.provider.type || "local",
  );
  let providerName = $state(initialConfig?.provider.name || "gemini-cli");
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

    if (
      config &&
      providerType === config.provider.type &&
      providerName === config.provider.name &&
      !hasVariablesChanged
    ) {
      return;
    }

    const providerChanged = providerName !== config?.provider.name;

    onSave({
      ...config,
      provider: providerChanged
        ? {
            type: providerType,
            name: providerName,
          }
        : {
            ...config?.provider,
            type: providerType,
            name: providerName,
          },
      variables: variablesObj,
    } as ProvarConfig);
  });
</script>

<aside
  class="absolute top-12 right-2 bottom-2 z-50 flex w-[400px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
>
  <div
    class="flex items-center justify-between border-b border-zinc-800/50 p-6"
  >
    <div class="flex items-center gap-2">
      <Settings size={20} class="text-indigo-400" />
      <h2 class="text-xl font-medium text-zinc-100">Project Settings</h2>
    </div>
  </div>

  <div class="flex-1 space-y-8 overflow-y-auto p-6">
    <section>
      <h3
        class="mb-4 text-xs font-medium tracking-wider text-zinc-500 uppercase"
      >
        AI Configuration
      </h3>

      <div class="space-y-6">
        <div>
          <label
            for="panel-provider-type"
            class="mb-2 block text-xs text-zinc-400"
          >
            Provider Type
          </label>
          <select
            id="panel-provider-type"
            bind:value={providerType}
            onchange={() => {
              if (providerType === "local") {
                providerName = "gemini-cli";
              } else {
                providerName = "openai";
              }
            }}
            class="w-full appearance-none rounded-lg border border-zinc-700/50 bg-[#0d1117] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_1rem_center] bg-no-repeat px-4 py-3.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="local">Local</option>
            <option value="remote">Remote</option>
          </select>
        </div>

        <div>
          <label
            for="panel-provider-name"
            class="mb-2 block text-xs text-zinc-400"
          >
            AI Provider
          </label>
          <select
            id="panel-provider-name"
            bind:value={providerName}
            class="w-full appearance-none rounded-lg border border-zinc-700/50 bg-[#0d1117] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_1rem_center] bg-no-repeat px-4 py-3.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            {#if providerType === "local"}
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
</aside>
