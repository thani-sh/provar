<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { editorStore } from '../stores/editor-store.svelte';
  import { InfiniteCanvas } from './infinite-canvas';

  let container: HTMLDivElement;
  let canvas: InfiniteCanvas | null = null;

  onMount(async () => {
    // Defer one frame so the container has its final layout box.
    // Calling getContext before the canvas has a non-zero size is
    // one of the things that triggers "WebGL: context lost" in
    // Wails's WKWebView.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    canvas = new InfiniteCanvas();
    canvas.onNodeSelect = (id) => {
      editorStore.selectedNodeId = id;
    };
    try {
      await canvas.init(container);
      if (editorStore.currentFile) {
        canvas.renderGraph(editorStore.currentFile);
      }
    } catch (e) {
      // Canvas failed to initialise (WebGL context lost in Wails's
      // WKWebView). Log it so the failure is visible; the rest of
      // the editor stays usable without the canvas.
      console.error("Canvas init failed:", e);
    }
  });

  onDestroy(() => {
    canvas?.destroy();
  });
</script>

<div bind:this={container} class="absolute inset-0"></div>