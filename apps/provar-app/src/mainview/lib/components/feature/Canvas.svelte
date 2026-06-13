<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { TestFile } from "@libs/domain/zod";
  import { InfiniteCanvas } from "../../canvas/infinite-canvas";
  import { editorStore } from "../../stores/editor-store.svelte";

  interface Props {
    testFile: TestFile | null;
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
    if (!infiniteCanvas) return;
    if (testFile) {
      // Structural rebuild — only when the testFile itself changes.
      // We intentionally do NOT include taskStates / runningPathNodeIds
      // here, otherwise every state update would destroy and recreate
      // dozens of PIXI.Graphics/Text/Container objects. That churn
      // stresses the WebGL context and is the root cause of
      // "WebGL: context lost" errors during long test runs.
      infiniteCanvas.renderGraph(testFile);
    } else {
      infiniteCanvas.clearGraph();
    }
  });

  $effect(() => {
    if (!infiniteCanvas || !testFile) return;
    // In-place state update — re-strokes existing PIXI objects instead
    // of recreating them. This is the fix for the WebGL context loss:
    // we go from N full rebuilds per test run to 1 full rebuild + N
    // cheap in-place updates.
    const taskStates = editorStore.taskStates;
    const runningPathNodeIds = editorStore.runningPathNodeIds;
    const compilationStates = editorStore.compilationStates;
    infiniteCanvas.updateGraphState(
      taskStates,
      runningPathNodeIds,
      compilationStates,
    );
  });

  onDestroy(() => {
    infiniteCanvas?.destroy();
  });
</script>

<div bind:this={container} class="h-full w-full"></div>
