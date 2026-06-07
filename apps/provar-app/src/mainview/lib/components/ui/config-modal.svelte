<script lang="ts">
  import type { ProvarConfig } from "@libs/domain/zod";

  interface Props {
    show: boolean;
    onConfirm: (config: ProvarConfig) => void;
  }

  let { show, onConfirm }: Props = $props();

  function handleConfirm() {
    onConfirm({ variables: {} });
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md"
  >
    <div
      class="w-[450px] rounded-2xl border border-zinc-800 bg-[#161b22] p-8 shadow-2xl"
    >
      <h2 class="mb-3 text-lg font-semibold text-zinc-100">
        Initialize Project
      </h2>
      <p class="mb-8 text-sm text-zinc-400">
        This workspace doesn't have a Provar configuration yet. Click below to
        initialize it and get started.
      </p>

      <button
        class="w-full rounded-lg bg-indigo-500 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-600 active:scale-[0.98]"
        onclick={handleConfirm}
      >
        Initialize Project
      </button>
    </div>
  </div>
{/if}
