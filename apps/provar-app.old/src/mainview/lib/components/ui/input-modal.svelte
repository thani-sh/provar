<script lang="ts">
  import { debug } from "../../../../shared/debug";

  interface Props {
    show: boolean;
    title: string;
    placeholder: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  }

  let { show, title, placeholder, onConfirm, onCancel }: Props = $props();
  let value = $state("");

  function handleConfirm() {
    debug("InputModal: Confirm clicked with value:", value);
    onConfirm(value);
    value = "";
  }

  function handleCancel() {
    debug("InputModal: Cancel clicked");
    onCancel();
    value = "";
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") handleCancel();
  }

  function focus(node: HTMLInputElement) {
    node.focus();
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
  >
    <div
      class="w-[400px] rounded-xl border border-zinc-800 bg-[#161b22] p-6 shadow-2xl"
    >
      <h2 class="mb-4 text-lg font-medium text-zinc-100">{title}</h2>

      <input
        type="text"
        bind:value
        {placeholder}
        class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        use:focus
        onkeydown={handleKeyDown}
      />

      <div class="mt-6 flex justify-end gap-3">
        <button
          class="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          onclick={handleCancel}
        >
          Cancel
        </button>
        <button
          class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          onclick={handleConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}
