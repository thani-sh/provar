<script lang="ts">
  import { projectStore } from './lib/stores/project-store.svelte';
  import { settingsStore } from './lib/stores/settings-store.svelte';
  import { historyStore } from './lib/stores/history-store.svelte';
  import Welcome from './lib/components/Welcome.svelte';
  import SetupWizard from './lib/components/SetupWizard.svelte';
  import Toolbar from './lib/components/Toolbar.svelte';
  import TestExplorer from './lib/components/TestExplorer.svelte';
  import Canvas from './lib/components/Canvas.svelte';
  import RightSidebar from './lib/components/RightSidebar.svelte';
  import AppModals from './lib/components/AppModals.svelte';

  // Both stores load on first mount; gated on "no project open yet"
  // so the load is skipped once a project is in flight. historyStore.load
  // is also what drives settingsStore.showSetupWizard (a missing
  // history file = first launch = show the wizard).
  $effect(() => {
    if (!projectStore.path) {
      settingsStore.load();
      historyStore.load();
    }
  });
</script>

<div
  class="relative h-screen w-full overflow-hidden overscroll-none bg-[rgba(14,17,22,0.7)] font-sans text-zinc-300"
>
  <div
    class="absolute top-0 right-0 left-0 z-40 h-[56px]"
    style="--wails-draggable:drag"
  ></div>

  {#if !projectStore.path}
    {#if settingsStore.showSetupWizard}
      <SetupWizard />
    {:else}
      <Welcome
        homeDir={settingsStore.homeDir}
        recentProjects={historyStore.recent}
        onOpen={(path) => {
          projectStore.openProject(path);
        }}
      />
    {/if}
  {:else}
    <Toolbar />
    <TestExplorer />
    <Canvas />
    <RightSidebar />
  {/if}

  <AppModals />
</div>