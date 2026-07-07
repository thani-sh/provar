<script lang="ts">
  import Modal from './Modal.svelte';

  interface Props {
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }
  let { show, title, message, onConfirm, onCancel }: Props = $props();
</script>

<Modal {show} {title} primaryLabel="Confirm" onPrimary={onConfirm} onClose={onCancel} primaryStyle="danger">
  <p class="text-sm leading-relaxed text-zinc-400">{message}</p>
</Modal>