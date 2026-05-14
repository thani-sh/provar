<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TestFile } from '../../../shared/domain';
  import { InfiniteCanvas } from '../canvas/InfiniteCanvas';

  interface Props {
    testFile: TestFile;
    selectedNodeId: string | null;
  }

  let { testFile, selectedNodeId = $bindable() } = $props<Props>();

  let container: HTMLElement;
  let infiniteCanvas: InfiniteCanvas;

  onMount(async () => {
    infiniteCanvas = new InfiniteCanvas();
    await infiniteCanvas.init(container);
    
    infiniteCanvas.onNodeSelect = (id) => {
      selectedNodeId = id;
    };

    if (testFile) {
      infiniteCanvas.renderGraph(testFile);
    }
  });

  $effect(() => {
    if (testFile && infiniteCanvas) {
      infiniteCanvas.renderGraph(testFile);
    }
  });

  onDestroy(() => {
    infiniteCanvas?.destroy();
  });
</script>

<div bind:this={container} class="w-full h-full"></div>
