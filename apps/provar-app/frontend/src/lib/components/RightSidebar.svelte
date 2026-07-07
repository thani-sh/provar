<script lang="ts">
  import { editorStore } from '../stores/editor-store.svelte';
  import { uiStore } from '../stores/ui-store.svelte';
  import PanelHeader from './PanelHeader.svelte';
  import NodeSidePanel from './NodeSidePanel.svelte';

  type PanelKind = 'config' | 'assistant' | 'node';

  // Active panel: a selected node wins, otherwise the user's tab choice.
  let active = $derived<PanelKind>(
    editorStore.selectedNodeId ? 'node' : uiStore.rightPanelTab,
  );
</script>

{#if uiStore.isRightSidebarOpen && active}
  <aside
    class="absolute top-0 right-0 bottom-0 z-20 flex w-[400px] flex-col border-l border-zinc-800 bg-[#161b22]/50 pt-[64px] backdrop-blur-md"
  >
    {#if active === 'config'}
      <PanelHeader title="Project Settings" />
      <div class="flex-1 overflow-y-auto p-6 text-xs text-zinc-500">
        <p>Config body lands in Phase 9.</p>
      </div>
    {:else if active === 'assistant'}
      <PanelHeader title="AI Assistant" />
      <div class="flex-1 overflow-y-auto p-6 text-xs text-zinc-500">
        <p>Assistant body lands when AI is added back in.</p>
      </div>
    {:else}
      <NodeSidePanel />
    {/if}
  </aside>
{/if}