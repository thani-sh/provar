<script lang="ts">
  import { editorStore } from '../stores/editor-store.svelte';
  import Canvas from '../canvas/Canvas.svelte';
</script>

{#if editorStore.currentFile}
  <Canvas />
  {:else}
  <div
    class="absolute inset-0 flex items-center justify-center pt-[48px] text-sm text-zinc-500"
  >
    <p>Select a test to begin</p>
  </div>
{/if}