<script lang="ts">
  import { fly } from "svelte/transition";
  import { editorStore } from "../../stores/editor-store.svelte";
  import { projectStore } from "../../stores/project-store.svelte";
  import { uiStore } from "../../stores/ui-store.svelte";
  import AssistantPanel from "./assistant-panel.svelte";
  import ConfigPanel from "./config-panel.svelte";
  import NodeSidePanel from "./node-side-panel.svelte";

  const asideClass =
    "absolute top-0 right-0 bottom-0 z-20 flex w-[400px] flex-col border-l border-zinc-800 bg-[#161b22]/50 pt-[4px] backdrop-blur-md";
</script>

{#if uiStore.isRightSidebarOpen && uiStore.isAssistantPanelOpen}
  <aside transition:fly={{ x: 400, duration: 200 }} class={asideClass}>
    <AssistantPanel selectedFile={editorStore.selectedFilePath} />
  </aside>
{/if}

{#if uiStore.isRightSidebarOpen && (uiStore.isConfigPanelOpen || (editorStore.selectedNode && editorStore.selectedNodeId))}
  <aside transition:fly={{ x: 400, duration: 200 }} class={asideClass}>
    {#if uiStore.isConfigPanelOpen}
      <ConfigPanel
        config={projectStore.config}
        onSave={(cfg) => projectStore.saveConfig(cfg)}
      />
    {:else if editorStore.selectedNode && editorStore.selectedNodeId}
      <NodeSidePanel
        node={editorStore.selectedNode}
        nodeId={editorStore.selectedNodeId}
        onUpdate={(id, updates) => editorStore.updateNode(id, updates)}
        onDelete={(id) => editorStore.deleteNode(id)}
      />
    {/if}
  </aside>
{/if}
