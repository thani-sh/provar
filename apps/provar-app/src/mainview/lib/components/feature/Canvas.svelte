<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { TestFile } from "@libs/domain/zod";
  import { InfiniteCanvas } from "../../canvas/InfiniteCanvas";
  import { editorStore } from "../../stores/EditorStore.svelte";

  interface Props {
    testFile: TestFile;
    selectedNodeId: string | null;
    onAddNode?: (fromId: string | null, toId: string | null) => void;
  }

  let { testFile, selectedNodeId = $bindable(), onAddNode }: Props = $props();

  let container: HTMLElement;
  let infiniteCanvas: InfiniteCanvas;

  onMount(async () => {
    infiniteCanvas = new InfiniteCanvas();
    await infiniteCanvas.init(container);

    infiniteCanvas.onNodeSelect = (id) => {
      selectedNodeId = id;
    };

    infiniteCanvas.onAddNode = (fromId, toId) => {
      onAddNode?.(fromId, toId);
    };

    if (testFile) {
      infiniteCanvas.renderGraph(testFile, editorStore.taskStates);
    }
  });

  $effect(() => {
    if (testFile && infiniteCanvas) {
      infiniteCanvas.renderGraph(
        testFile,
        editorStore.taskStates,
        editorStore.runningPathNodeIds,
      );
    }
  });

  onDestroy(() => {
    infiniteCanvas?.destroy();
  });
</script>

<div bind:this={container} class="h-full w-full"></div>
