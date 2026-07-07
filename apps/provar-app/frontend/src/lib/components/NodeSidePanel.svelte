<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
  import { editorStore } from '../stores/editor-store.svelte';
  import PanelHeader from './PanelHeader.svelte';

  let title = $state('');
  let info = $state('');
  let data = $state('');

  // Sync local form state with the selected node on change.
  $effect(() => {
    const node = editorStore.selectedNode;
    title = node?.title ?? '';
    info = node?.info ?? '';
    data = JSON.stringify(node?.data ?? {}, null, 2);
  });

  let dataError = $state<string | null>(null);

  function commit() {
    const id = editorStore.selectedNodeId;
    if (!id) return;
    let parsed: unknown = {};
    try {
      parsed = data.trim() ? JSON.parse(data) : {};
      dataError = null;
    } catch (e) {
      dataError = (e as Error).message;
      return;
    }
    editorStore.updateNode(id, {
      title,
      info,
      data: parsed as never,
    });
  }

  function remove() {
    // TODO: real delete in a later phase — needs confirm modal + graph
    // surgery. For v1 just clear the selection so the panel closes.
    editorStore.selectedNodeId = null;
  }
</script>

{#if editorStore.selectedNode}
  <PanelHeader title="Task Settings">
    <button
      type="button"
      class="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
      title="Delete node (Phase 12)"
      onclick={remove}
    >
      <Trash2 class="h-3.5 w-3.5" />
    </button>
  </PanelHeader>

  <div class="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
    <div>
      <label class="mb-1 block text-zinc-500" for="node-title">Title</label>
      <input
        id="node-title"
        type="text"
        bind:value={title}
        onblur={commit}
        class="w-full rounded border border-zinc-700/50 bg-[#21262d] px-2.5 py-1.5 text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </div>

    <div>
      <label class="mb-1 block text-zinc-500" for="node-info">Description</label>
      <textarea
        id="node-info"
        bind:value={info}
        onblur={commit}
        rows="3"
        class="w-full rounded border border-zinc-700/50 bg-[#21262d] px-2.5 py-1.5 text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      ></textarea>
    </div>

    <div>
      <label class="mb-1 block text-zinc-500" for="node-data">Data (JSON)</label>
      <textarea
        id="node-data"
        bind:value={data}
        onblur={commit}
        rows="6"
        class="w-full rounded border border-zinc-700/50 bg-[#21262d] px-2.5 py-1.5 font-mono text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      ></textarea>
      {#if dataError}
        <p class="mt-1 text-red-400">{dataError}</p>
      {/if}
    </div>
  </div>
{/if}