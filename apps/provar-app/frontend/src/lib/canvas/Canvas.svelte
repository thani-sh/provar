<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { editorStore } from '../stores/editor-store.svelte';
  import { InfiniteCanvas } from './infinite-canvas';

  let container: HTMLDivElement;
  let canvas: InfiniteCanvas | null = null;

  onMount(async () => {
    canvas = new InfiniteCanvas();
    canvas.onNodeSelect = (id) => {
      editorStore.selectedNodeId = id;
    };
    await canvas.init(container);
    if (editorStore.currentFile) {
      canvas.renderGraph(editorStore.currentFile);
    }
  });

  onDestroy(() => {
    canvas?.destroy();
  });
</script>

<div bind:this={container} class="absolute inset-0 pt-[36px]"></div>