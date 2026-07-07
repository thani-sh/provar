<script lang="ts">
  import { tick } from 'svelte';
  import Modal from './Modal.svelte';

  interface Props {
    show: boolean;
    title: string;
    placeholder: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  }
  let { show, title, placeholder, onConfirm, onCancel }: Props = $props();
  let value = $state('');
  let input: HTMLInputElement | undefined = $state();

  // Focus the input when the modal opens.
  $effect(() => {
    if (show) {
      tick().then(() => input?.focus());
    } else {
      value = '';
    }
  });
</script>

<Modal {show} {title} primaryLabel="Confirm" onPrimary={() => onConfirm(value)} onClose={onCancel}>
  <input
    type="text"
    bind:value
    bind:this={input}
    {placeholder}
    class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
    onkeydown={(e) => {
      if (e.key === 'Enter') onConfirm(value);
    }}
  />
</Modal>