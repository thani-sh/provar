<script lang="ts">
  import { onMount } from "svelte";
  import { ProvarAPI } from "./lib/api/provar";
  import { editorStore } from "./lib/stores/editor-store.svelte";
  import { projectStore } from "./lib/stores/project-store.svelte";
  import { settingsStore } from "./lib/stores/settings-store.svelte";
  import { uiStore } from "./lib/stores/ui-store.svelte";
  import { installWorkspaceEffects } from "./lib/workspace-effects.svelte";

  import AppModals from "./lib/components/feature/app-modals.svelte";
  import Canvas from "./lib/components/feature/Canvas.svelte";
  import EditorToolbar from "./lib/components/feature/editor-toolbar.svelte";
  import EmptyState from "./lib/components/feature/empty-state.svelte";
  import RightSidebar from "./lib/components/feature/right-sidebar.svelte";
  import SetupWizard from "./lib/components/ui/setup-wizard.svelte";
  import TestExplorer from "./lib/components/feature/test-explorer.svelte";

  onMount(() => {
    projectStore.initialize();
    installWorkspaceEffects();

    // The settings load (and the first-launch wizard decision) is gated on
    // "no project open yet" — once a project loads, the landing view is
    // hidden and the wizard is irrelevant.
    $effect(() => {
      if (!projectStore.path) {
        settingsStore.loadIfNeeded();
      }
    });

    const refreshInterval = setInterval(() => {
      projectStore.refreshFiles();
    }, 30000);

    return () => clearInterval(refreshInterval);
  });

  async function handleOpenPath(path: string) {
    const res = await ProvarAPI.openProject({ path });
    if (!res.success) {
      uiStore.showToast("error", `Could not open ${path}`);
    }
  }

  function handleWorkspaceClick() {
    uiStore.closeAllPanels();
  }
</script>

<div
  class="relative h-screen w-full overflow-hidden overscroll-none bg-[#0e1116] font-sans text-zinc-300"
>
  <!-- Window drag region + sidebar toggle -->
  <div
    class="electrobun-webkit-app-region-drag absolute top-0 right-0 left-0 z-40 h-[28px]"
  >
    {#if projectStore.path}
      <button
        onclick={() => uiStore.toggleSidebar()}
        class="electrobun-webkit-app-region-no-drag pointer-events-auto absolute top-[2px] left-[65px] flex h-6 w-6 items-center justify-center text-zinc-300 opacity-60 transition-opacity hover:opacity-100 focus:outline-none"
        title={uiStore.isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        aria-label={uiStore.isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
    {/if}
  </div>

  <EditorToolbar />

  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="absolute inset-0 touch-none overscroll-none"
    onclick={handleWorkspaceClick}
    role="button"
    tabindex="-1"
  >
    {#if !projectStore.path}
      {#if settingsStore.showSetupWizard}
        <!-- The setup wizard takes the place of the regular landing on first
             launch (no ~/.provar/settings.json). It's not an overlay — the
             recent projects / "Create sample" view is not rendered behind
             it. When the wizard saves, it auto-closes and the empty state
             below becomes the new landing. -->
        <SetupWizard
          show={true}
          onClose={() => settingsStore.dismissSetupWizard()}
        />
      {:else}
        <EmptyState
          homeDir={settingsStore.homeDir}
          recentProjects={settingsStore.recentProjects}
          onOpen={handleOpenPath}
          onError={(m) => uiStore.showToast("error", m)}
        />
      {/if}
    {:else if editorStore.currentFile}
      <Canvas
        testFile={editorStore.currentFile}
        bind:selectedNodeId={editorStore.selectedNodeId}
        onAddNode={(from, to) => editorStore.addNode(from, to)}
      />
    {:else}
      <div class="flex h-full items-center justify-center text-zinc-500">
        <p>Select a test to begin</p>
      </div>
    {/if}
  </div>

  {#if projectStore.path}
    <TestExplorer
      files={projectStore.tests}
      selectedFile={editorStore.selectedFilePath}
      onSelect={(path) => editorStore.loadFile(path)}
      onCreateFile={(parent) => uiStore.openInputModal("file", parent)}
      onCreateFolder={(parent) => uiStore.openInputModal("folder", parent)}
      onDelete={(path) => editorStore.deletePath(path)}
      onShowConfig={() => uiStore.toggleConfig()}
      onShowAI={() => uiStore.toggleAssistant()}
    />
  {/if}

  <RightSidebar />

  <AppModals />
</div>
