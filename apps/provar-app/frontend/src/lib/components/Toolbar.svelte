<script lang="ts">
  import { PanelLeft, Settings, Sparkles, Play } from 'lucide-svelte';
  import { projectStore } from '../stores/project-store.svelte';
  import { editorStore } from '../stores/editor-store.svelte';
  import { uiStore } from '../stores/ui-store.svelte';

  let projectName = $derived(
    projectStore.path
      ? projectStore.path.split('/').pop() ?? projectStore.path
      : 'No project',
  );

  let fileName = $derived(
    editorStore.selectedFilePath
      ? editorStore.selectedFilePath.split('/').pop()
      : null,
  );
</script>

<div
  class="absolute top-0 right-0 left-0 z-30 flex h-9 items-center gap-3 border-b border-zinc-800/50 px-3 pt-[28px] text-xs text-zinc-400"
>
  <button
    type="button"
    class="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
    title={uiStore.isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
    onclick={() => uiStore.toggleSidebar()}
  >
    <PanelLeft class="h-3.5 w-3.5" />
  </button>

  <span class="font-mono font-medium text-zinc-200">{projectName}</span>

  {#if fileName}
    <span class="text-zinc-600">·</span>
    <span class="font-mono text-zinc-400">{fileName}</span>
  {/if}

  <div class="flex-1"></div>

  <button
    type="button"
    class="flex items-center gap-1.5 rounded px-2.5 py-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
    title="Run test (Phase 12)"
    disabled
  >
    <Play class="h-3.5 w-3.5" />
    Run
  </button>

  <button
    type="button"
    class="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
    title="Project Settings"
    onclick={() => uiStore.openRightPanel('config')}
  >
    <Settings class="h-3.5 w-3.5" />
  </button>

  <button
    type="button"
    class="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
    title="AI Assistant"
    onclick={() => uiStore.openRightPanel('assistant')}
  >
    <Sparkles class="h-3.5 w-3.5" />
  </button>
</div>