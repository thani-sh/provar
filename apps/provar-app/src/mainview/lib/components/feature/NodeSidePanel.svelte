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
  <div
    class="flex items-center justify-between border-b border-zinc-800/50 px-6 pt-2.5 pb-2.5"
  >
    <h2 class="text-sm font-semibold text-zinc-200">Task Settings</h2>
    <div class="flex items-center gap-1">
      <button
        disabled={editorStore.isRunning ||
          editorStore.selectedNodePathIndex === null}
        onclick={() => {
          const idx = editorStore.selectedNodePathIndex;
          if (idx !== null) editorStore.runPath(idx);
        }}
        class="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-[#21262d] hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
        title="Run the full path containing this node"
      >
        <Play size={12} class="fill-current" />
      </button>
      <button
        disabled={editorStore.isRunning ||
          editorStore.selectedNodePathIndex === null}
        onclick={() => {
          const idx = editorStore.selectedNodePathIndex;
          if (idx !== null) editorStore.runPathUpTo(idx, nodeId);
        }}
        class="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-[#21262d] hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
        title="Run the path and stop at this node"
      >
        <ArrowRightToLine size={14} />
      </button>
    </div>
  </div>

  <div class="flex-1 space-y-4 overflow-y-auto p-6">
    <section class="space-y-4">
      <div>
        <label
          for="node-title"
          class="mb-2 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
        >
          Task Name
        </label>
        <input
          id="node-title"
          type="text"
          value={node.title}
          oninput={handleTitleChange}
          class="w-full rounded-lg border border-zinc-700/50 bg-[#0d1117] px-3.5 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          for="node-info"
          class="mb-2 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
        >
          Description
        </label>
        <textarea
          id="node-info"
          value={node.info}
          oninput={handleInfoChange}
          rows="3"
          class="w-full resize-none rounded-lg border border-zinc-700/50 bg-[#0d1117] p-3 text-sm leading-relaxed text-zinc-300 placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          placeholder="Add a description..."
        ></textarea>
      </div>
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
            class="flex items-center rounded-lg border border-zinc-800/40 bg-zinc-900/30 p-0.5 shadow-sm backdrop-blur-md"
          >
            <button
              class="flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all {viewMode ===
              'baseline'
                ? 'border border-zinc-700/20 bg-[#21262d]/60 text-zinc-100 shadow-sm'
                : 'border border-transparent text-zinc-500 hover:text-zinc-300'}"
              disabled={!baseline}
              onclick={() => (viewMode = "baseline")}
            >
              Baseline
            </button>
            <button
              class="flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all {viewMode ===
              'current'
                ? 'border border-zinc-700/20 bg-[#21262d]/60 text-zinc-100 shadow-sm'
                : 'border border-transparent text-zinc-500 hover:text-zinc-300'}"
              disabled={!current}
              onclick={() => (viewMode = "current")}
            >
              Current
            </button>
            <button
              class="flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all {viewMode ===
              'diff'
                ? 'border border-zinc-700/20 bg-[#21262d]/60 text-zinc-100 shadow-sm'
                : 'border border-transparent text-zinc-500 hover:text-zinc-300'}"
              disabled={!diffDataUrl}
              onclick={() => (viewMode = "diff")}
            >
              Diff {#if mismatchPercentage > 0}({mismatchPercentage}%){/if}
            </button>
          </div>

          <div
            class="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
          >
            {#if viewMode === "baseline" && baseline}
              <img
                src={baseline}
                alt="Baseline UI State"
                class="h-full w-full object-cover"
              />
            {:else if viewMode === "current" && current}
              <img
                src={current}
                alt="Current UI State"
                class="h-full w-full object-cover"
              />
              <button
                onclick={() => editorStore.acceptVisualStateForNode(nodeId)}
                class="absolute right-2 bottom-2 z-10 rounded-lg border border-zinc-700 bg-zinc-900/80 p-1.5 text-zinc-300 backdrop-blur-sm transition-all hover:border-green-500/40 hover:bg-green-500/20 hover:text-green-400"
                title="Accept Visual State as Baseline"
              >
                <Check size={14} />
              </button>
            {:else if viewMode === "diff" && diffDataUrl}
              <img
                src={diffDataUrl}
                alt="Visual Mismatch Diff"
                class="h-full w-full object-cover"
              />
            {:else}
              <span class="text-xs text-zinc-600">Image unavailable</span>
            {/if}
          </div>

          <label
            class="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 shadow-sm transition-all select-none hover:border-zinc-700 hover:bg-[#21262d]/20"
          >
            <input
              type="checkbox"
              checked={node.config?.visualCompare ?? false}
              onchange={(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                onUpdate(nodeId, {
                  config: { ...node.config, visualCompare: checked },
                });
              }}
              class="peer sr-only"
              id="visual-compare-checkbox"
            />
            <div
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-900 {node
                .config?.visualCompare
                ? 'border-indigo-500/80 bg-indigo-600 text-white shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                : 'border-zinc-700 bg-zinc-900 text-transparent hover:border-zinc-600'}"
            >
              {#if node.config?.visualCompare}
                <svg
                  class="h-2.5 w-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {/if}
            </div>
            <span class="text-xs text-zinc-400">
              Enforce Visual Regression Check
            </span>
          </label>
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
