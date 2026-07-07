<script lang="ts">
  import { editorStore } from '../stores/editor-store.svelte';
</script>

<div class="absolute inset-0 flex items-center justify-center pt-[36px] text-sm text-zinc-500">
  {#if editorStore.currentFile}
    <p>Canvas — graph editor for {editorStore.selectedFilePath}</p>
  {:else}
    <p>Select a test to begin</p>
  {/if}
</div>