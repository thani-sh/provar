<script lang="ts">
  import { editorStore } from '../stores/editor-store.svelte';
  import { uiStore } from '../stores/ui-store.svelte';
</script>

{#if uiStore.isRightSidebarOpen}
  <aside
    class="absolute top-0 right-0 bottom-0 z-20 flex w-[400px] flex-col border-l border-zinc-800 bg-[#161b22]/50 pt-[64px] backdrop-blur-md"
  >
    <div class="flex-1 overflow-y-auto p-6 text-xs text-zinc-500">
      <h2 class="mb-2 text-sm font-semibold text-zinc-200">
        {uiStore.rightPanelTab === 'config' ? 'Project Settings' : 'AI Assistant'}
      </h2>
      {#if uiStore.rightPanelTab === 'config'}
        <p>Config panel — body lands in Phase 9.</p>
      {:else}
        <p>Assistant panel — body lands when AI is added back in.</p>
      {/if}
      {#if editorStore.selectedNode}
        <hr class="my-4 border-zinc-800" />
        <p>Selected node: <span class="font-mono">{editorStore.selectedNode.id}</span></p>
      {/if}
    </div>
  </aside>
{/if}