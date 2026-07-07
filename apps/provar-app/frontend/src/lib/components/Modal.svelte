<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    show: boolean;
    title: string;
    primaryLabel?: string;
    onPrimary?: () => void;
    onClose: () => void;
    primaryStyle?: 'danger' | 'primary';
    children?: Snippet;
  }

  let {
    show,
    title,
    primaryLabel,
    onPrimary,
    onClose,
    primaryStyle = 'primary',
    children,
  }: Props = $props();

  // Attach the keydown listener only while the modal is open so it
  // doesn't fire for every keystroke across the whole app lifetime.
  $effect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && onPrimary) onPrimary();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
</script>

{#if show}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    role="presentation"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
  >
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="w-[400px] rounded-xl border border-zinc-800 bg-[#161b22] p-6 shadow-2xl"
      role="dialog"
      aria-labelledby="modal-title"
      onclick={(e) => e.stopPropagation()}
    >
      <h2 id="modal-title" class="mb-4 text-lg font-medium text-zinc-100">
        {title}
      </h2>

      {#if children}{@render children()}{/if}

      {#if primaryLabel && onPrimary}
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
            onclick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors {primaryStyle ===
            'danger'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-indigo-500 hover:bg-indigo-600'}"
            onclick={onPrimary}
          >
            {primaryLabel}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}