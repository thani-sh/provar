<script lang="ts">
  import type { TestNode } from "@libs/domain/zod";
  import {
    Check,
    Image as ImageIcon,
    Share2,
    Trash2,
    Play,
    ArrowRightToLine,
  } from "lucide-svelte";
  import { editorStore } from "../../stores/EditorStore.svelte";

  let {
    node,
    nodeId,
    onUpdate,
    onDelete,
  }: {
    node: TestNode;
    nodeId: string;
    onUpdate: (id: string, updates: Partial<TestNode>) => void;
    onDelete: (id: string) => void;
  } = $props();

  const hasSubGraph = $derived(!!node.graph);

  function handleTitleChange(e: Event) {
    const title = (e.target as HTMLInputElement).value;
    onUpdate(nodeId, { title });
  }

  function handleInfoChange(e: Event) {
    const info = (e.target as HTMLTextAreaElement).value;
    onUpdate(nodeId, { info });
  }

  // Visual comparison state
  let screenshots = $derived(editorStore.screenshots[nodeId] || {});
  let baseline = $derived(screenshots.baseline);
  let current = $derived(screenshots.current);

  let viewMode = $state<"baseline" | "current" | "diff">("current");
  let diffDataUrl = $state<string | null>(null);
  let mismatchPercentage = $state<number>(0);

  async function generateDiff(img1Url: string, img2Url: string) {
    return new Promise<void>((resolve) => {
      const img1 = new window.Image();
      const img2 = new window.Image();
      let loadedCount = 0;

      const onLoaded = () => {
        loadedCount++;
        if (loadedCount === 2) {
          const width = Math.max(img1.width, img2.width);
          const height = Math.max(img1.height, img2.height);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve();

          // Draw img1 (baseline)
          ctx.drawImage(img1, 0, 0);
          const imgData1 = ctx.getImageData(0, 0, width, height);

          // Clear and Draw img2 (current)
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img2, 0, 0);
          const imgData2 = ctx.getImageData(0, 0, width, height);

          // Create diff image data
          const diffData = ctx.createImageData(width, height);
          let diffPixels = 0;

          for (let i = 0; i < imgData1.data.length; i += 4) {
            const r1 = imgData1.data[i] ?? 0;
            const g1 = imgData1.data[i + 1] ?? 0;
            const b1 = imgData1.data[i + 2] ?? 0;
            const a1 = imgData1.data[i + 3] ?? 0;

            const r2 = imgData2.data[i] ?? 0;
            const g2 = imgData2.data[i + 1] ?? 0;
            const b2 = imgData2.data[i + 2] ?? 0;
            const a2 = imgData2.data[i + 3] ?? 0;

            const diff =
              Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

            if (diff > 30 || Math.abs(a1 - a2) > 30) {
              // Red highlighter for mismatches
              diffData.data[i] = 255;
              diffData.data[i + 1] = 0;
              diffData.data[i + 2] = 0;
              diffData.data[i + 3] = 255;
              diffPixels++;
            } else {
              // Transparent gray for matched regions
              diffData.data[i] = r1;
              diffData.data[i + 1] = g1;
              diffData.data[i + 2] = b1;
              diffData.data[i + 3] = 80;
            }
          }

          ctx.putImageData(diffData, 0, 0);
          diffDataUrl = canvas.toDataURL("image/png");
          mismatchPercentage = Number(
            ((diffPixels / (width * height)) * 100).toFixed(2),
          );
          resolve();
        }
      };

      img1.onload = onLoaded;
      img2.onload = onLoaded;
      img1.onerror = () => resolve();
      img2.onerror = () => resolve();

      img1.src = img1Url;
      img2.src = img2Url;
    });
  }

  $effect(() => {
    if (baseline && current) {
      generateDiff(baseline, current);
    } else {
      diffDataUrl = null;
      mismatchPercentage = 0;
    }
  });

  $effect(() => {
    // Reset viewMode when node selection changes
    if (nodeId) {
      viewMode = "current";
    }
  });
</script>

<div class="flex h-full w-full flex-col">
  <div class="flex flex-col border-b border-zinc-800/50 p-6">
    <input
      type="text"
      value={node.title}
      oninput={handleTitleChange}
      class="mb-2 -ml-1 rounded bg-transparent px-1 text-xl font-medium text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500/50"
    />
    <textarea
      value={node.info}
      oninput={handleInfoChange}
      rows="3"
      class="-ml-1 resize-none rounded bg-transparent px-1 text-sm leading-relaxed text-zinc-400 outline-none focus:ring-1 focus:ring-indigo-500/50"
    ></textarea>
  </div>

  <div class="flex-1 space-y-8 overflow-y-auto p-6">
    <section>
      <h3
        class="mb-3 text-sm font-medium tracking-wider text-zinc-400 uppercase"
      >
        Run
      </h3>
      <div class="flex gap-2">
        <button
          disabled={editorStore.isRunning ||
            editorStore.selectedNodePathIndex === null}
          onclick={() => {
            const idx = editorStore.selectedNodePathIndex;
            if (idx !== null) editorStore.runPath(idx);
          }}
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors
            {editorStore.isRunning || editorStore.selectedNodePathIndex === null
            ? 'cursor-not-allowed border-zinc-800/50 text-zinc-600'
            : 'cursor-pointer border-zinc-700/60 text-zinc-300 hover:border-green-500/40 hover:bg-green-500/10 hover:text-green-400'}"
          title="Run the full path containing this node"
        >
          <Play size={11} class="fill-current" />
          Run path
        </button>
        <button
          disabled={editorStore.isRunning ||
            editorStore.selectedNodePathIndex === null}
          onclick={() => {
            const idx = editorStore.selectedNodePathIndex;
            if (idx !== null) editorStore.runPathUpTo(idx, nodeId);
          }}
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors
            {editorStore.isRunning || editorStore.selectedNodePathIndex === null
            ? 'cursor-not-allowed border-zinc-800/50 text-zinc-600'
            : 'cursor-pointer border-zinc-700/60 text-zinc-300 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400'}"
          title="Run the path and stop at this node"
        >
          <ArrowRightToLine size={11} />
          Run up to here
        </button>
      </div>
      {#if editorStore.allPaths.length > 1 && editorStore.selectedNodePathIndex !== null}
        <p class="mt-2 text-[10px] text-zinc-600">
          Path {editorStore.selectedNodePathIndex + 1} of {editorStore.allPaths
            .length}
        </p>
      {/if}
    </section>

    <section>
      <h3
        class="mb-3 text-sm font-medium tracking-wider text-zinc-400 uppercase"
      >
        Validation Controls
      </h3>
      <label class="flex cursor-pointer items-start gap-3 select-none">
        <input
          type="checkbox"
          checked={node.config?.visualCompare ?? false}
          onchange={(e) => {
            const checked = (e.target as HTMLInputElement).checked;
            onUpdate(nodeId, {
              config: { ...node.config, visualCompare: checked },
            });
          }}
          class="mt-1 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
        />
        <div>
          <span class="text-sm font-medium text-zinc-300"
            >Enforce Visual Regression Check</span
          >
          <span class="mt-1 block text-xs font-normal text-zinc-500">
            Disabled by default. If enabled, any visual deviation at this step
            will trigger an execution failure.
          </span>
        </div>
      </label>
    </section>

    <section>
      <h3
        class="mb-3 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase"
      >
        Visual Comparison
      </h3>

      {#if baseline || current}
        <div class="flex flex-col gap-3">
          <div
            class="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5"
          >
            <button
              class="flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all {viewMode ===
              'baseline'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'}"
              disabled={!baseline}
              onclick={() => (viewMode = "baseline")}
            >
              Baseline
            </button>
            <button
              class="flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all {viewMode ===
              'current'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'}"
              disabled={!current}
              onclick={() => (viewMode = "current")}
            >
              Current
            </button>
            <button
              class="flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all {viewMode ===
              'diff'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'}"
              disabled={!diffDataUrl}
              onclick={() => (viewMode = "diff")}
            >
              Diff {#if mismatchPercentage > 0}({mismatchPercentage}%){/if}
            </button>
          </div>

          <div
            class="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-2"
          >
            {#if viewMode === "baseline" && baseline}
              <img
                src={baseline}
                alt="Baseline UI State"
                class="max-h-full max-w-full object-contain"
              />
            {:else if viewMode === "current" && current}
              <img
                src={current}
                alt="Current UI State"
                class="max-h-full max-w-full object-contain"
              />
            {:else if viewMode === "diff" && diffDataUrl}
              <img
                src={diffDataUrl}
                alt="Visual Mismatch Diff"
                class="max-h-full max-w-full object-contain"
              />
            {:else}
              <span class="text-xs text-zinc-600">Image unavailable</span>
            {/if}
          </div>

          {#if current}
            <button
              onclick={() => editorStore.acceptVisualStateForNode(nodeId)}
              class="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-500"
            >
              Accept Visual State as Baseline
            </button>
          {/if}
        </div>
      {:else}
        <div
          class="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-zinc-500"
        >
          <ImageIcon size={24} class="mb-2 opacity-50" />
          <span class="text-sm">No screenshots recorded</span>
        </div>
      {/if}
    </section>

    {#if hasSubGraph}
      <section>
        <div
          class="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-5"
        >
          <div class="mb-3 flex items-center gap-3">
            <div class="rounded-lg bg-indigo-500/20 p-2 text-indigo-400">
              <Share2 size={18} />
            </div>
            <div>
              <h3 class="text-sm font-medium text-zinc-200">
                Contains Sub-Graph
              </h3>
              <p class="mt-0.5 text-xs text-zinc-400">
                This task acts as a container for detailed steps.
              </p>
            </div>
          </div>
          <button
            class="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
          >
            View Sub-Graph
          </button>
        </div>
      </section>
    {/if}

    <section class="pb-8">
      <h3
        class="mb-3 text-sm font-medium tracking-wider text-zinc-400 uppercase"
      >
        Task Controls
      </h3>
      <button
        onclick={() => onDelete(nodeId)}
        class="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
      >
        <Trash2 size={16} />
        Delete Node Branch
      </button>
    </section>
  </div>
</div>
