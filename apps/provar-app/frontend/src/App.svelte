<script lang="ts">
  import { projectStore } from './lib/stores/project-store.svelte';
  import { settingsStore } from './lib/stores/settings-store.svelte';
  import { Dialog } from './lib/api';
  import Welcome from './lib/components/Welcome.svelte';
  import SetupWizard from './lib/components/SetupWizard.svelte';
  import Toolbar from './lib/components/Toolbar.svelte';
  import TestExplorer from './lib/components/TestExplorer.svelte';
  import Canvas from './lib/components/Canvas.svelte';
  import RightSidebar from './lib/components/RightSidebar.svelte';
  import AppModals from './lib/components/AppModals.svelte';

  // Settings load is gated on "no project open yet" — once a project
  // loads, the landing view is hidden and the wizard is irrelevant.
  $effect(() => {
    if (!projectStore.path) {
      settingsStore.load();
    }
  });

  async function pickProject() {
    try {
      const path = await Dialog.SelectProject();
      if (!path) return; // user cancelled
      await projectStore.openProject(path);
      settingsStore.prependRecent(path);
    } catch (e) {
      console.error('Failed to select project:', e);
    }
  }
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
        recentProjects={settingsStore.recentProjects}
        onOpen={(path) => {
          projectStore.openProject(path);
          settingsStore.prependRecent(path);
        }}
        onError={(m) => console.warn(m)}
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