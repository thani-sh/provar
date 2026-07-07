<script lang="ts">
  import { uiStore } from '../stores/ui-store.svelte';
  import { projectStore } from '../stores/project-store.svelte';
</script>

{#if uiStore.isSidebarOpen}
  <aside
    class="absolute top-0 bottom-0 left-0 z-20 flex w-[260px] flex-col border-r border-zinc-800 bg-[#161b22]/50 pt-[64px] backdrop-blur-md"
  >
    <div class="flex-1 overflow-y-auto p-4 text-xs text-zinc-500">
      {#if projectStore.tests.length === 0}
        <p>Test explorer — files will appear here.</p>
      {:else}
        <ul>
          {#each projectStore.tests as file}
            <li class="font-mono">{file}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </aside>
{/if}