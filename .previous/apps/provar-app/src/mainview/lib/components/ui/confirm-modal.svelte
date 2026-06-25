<script lang="ts">
  interface Props {
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { show, title, message, onConfirm, onCancel }: Props = $props();

  function handleConfirm() {
    onConfirm();
  }

  function handleCancel() {
    onCancel();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!show) return;
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") handleCancel();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if show}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
  >
    <div
      class="w-[400px] rounded-xl border border-zinc-800 bg-[#161b22] p-6 shadow-2xl"
      role="dialog"
      aria-labelledby="confirm-modal-title"
    >
      <h2
        id="confirm-modal-title"
        class="mb-4 text-lg font-medium text-zinc-100"
      >
        {title}
      </h2>

      <p class="text-sm leading-relaxed text-zinc-400">{message}</p>

      <div class="mt-6 flex justify-end gap-3">
        <button
          class="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          onclick={handleCancel}
        >
          Cancel
        </button>
        <button
          class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
          onclick={handleConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}
