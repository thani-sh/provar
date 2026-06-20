<script lang="ts">
  import {
    File,
    Play,
    ChevronDown,
    Layers,
    X,
    Hammer,
    RefreshCw,
  } from "lucide-svelte";
  import { editorStore } from "../../stores/editor-store.svelte";
  import { uiStore } from "../../stores/ui-store.svelte";

  let runMenuOpen = $state(false);

  // Close the run menu when the user clicks anywhere outside the toolbar.
  // The chevron button uses stopPropagation so opening the menu doesn't
  // immediately re-close it.
  function handleDocumentClick(e: MouseEvent) {
    if (!runMenuOpen) return;
    const target = e.target as Node | null;
    if (target && !toolbarEl?.contains(target)) {
      runMenuOpen = false;
    }
  }

  let toolbarEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  });
</script>

{#if editorStore.selectedFilePath}
  <div
    bind:this={toolbarEl}
    class="absolute top-[8px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2"
  >
    <button
      onclick={() => uiStore.toggleSidebar()}
      class="flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800/80 bg-[#161b22]/80 px-3 py-1 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur-sm transition-all duration-300 select-none hover:border-zinc-700/90 hover:bg-[#21262d]/90 focus:ring-1 focus:ring-zinc-700 focus:outline-none"
      title={uiStore.isSidebarOpen
        ? "Hide Test Explorer"
        : "Show Test Explorer"}
    >
      <File class="h-3.5 w-3.5 text-blue-400" />
      <span class="tracking-wide"
        >{editorStore.selectedFilePath.replace(/^\.provar\/tests\//, "")}</span
      >
    </button>

    {#if editorStore.isCompiling}
      <div
        class="flex h-[26px] items-center gap-1.5 rounded-full border border-zinc-800/80 bg-[#161b22]/80 px-3 py-1 text-xs text-zinc-400 shadow-sm backdrop-blur-sm"
      >
        <div
          class="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-blue-500"
        ></div>
        <span>Compiling...</span>
      </div>
    {:else if !editorStore.currentFile?.code}
      <button
        onclick={() => editorStore.compileCurrentTest()}
        class="flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800/80 bg-[#161b22]/80 px-3 py-1 text-xs font-medium text-zinc-400 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-blue-500/80 hover:bg-[#21262d]/90 hover:text-blue-400 focus:outline-none"
        title="Compiled TypeScript file not found. Click to compile."
      >
        <Hammer size={11} class="shrink-0" />
        <span>Compile</span>
      </button>
    {:else if !editorStore.currentFile.code.valid}
      <button
        onclick={() => editorStore.compileCurrentTest()}
        class="flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border border-amber-900/50 bg-[#161b22]/80 px-3 py-1 text-xs font-medium text-amber-500 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-amber-500/80 hover:bg-[#21262d]/90 hover:text-amber-400 focus:outline-none"
        title="Test file changed since last compilation. Click to recompile."
      >
        <RefreshCw size={11} class="shrink-0" />
        <span>Recompile</span>
      </button>
    {:else if editorStore.isRunning || editorStore.isRunningAllPaths}
      <div
        class="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-zinc-800/80 bg-[#161b22]/80 shadow-sm backdrop-blur-sm"
      >
        <div
          class="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-blue-500"
        ></div>
      </div>
    {:else}
      <div class="relative flex">
        <!-- Split button: left = smart run, right = dropdown chevron -->
        <button
          onclick={() => {
            const idx = editorStore.selectedNodePathIndex;
            if (idx !== null) {
              editorStore.runPath(idx);
            } else {
              editorStore.runAllPaths();
            }
          }}
          class="flex h-[26px] cursor-pointer items-center gap-1 rounded-l-full border border-zinc-800/80 bg-[#161b22]/80 pr-2 pl-2.5 text-zinc-400 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/90 hover:bg-[#21262d]/90 hover:text-green-400 focus:outline-none"
          title={editorStore.selectedNodePathIndex !== null
            ? "Run selected path"
            : "Run all paths"}
        >
          <Play size={10} class="fill-current" />
        </button>
        <button
          onclick={(e) => {
            e.stopPropagation();
            runMenuOpen = !runMenuOpen;
          }}
          class="flex h-[26px] cursor-pointer items-center rounded-r-full border border-l-0 border-zinc-800/80 bg-[#161b22]/80 px-1.5 text-zinc-500 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/90 hover:bg-[#21262d]/90 hover:text-zinc-300 focus:outline-none"
          title="Run options"
        >
          <ChevronDown size={10} />
        </button>

        {#if runMenuOpen}
          <div
            class="absolute top-[30px] right-0 z-50 min-w-[140px] overflow-hidden rounded-lg border border-zinc-800 bg-[#161b22] shadow-xl"
          >
            <!-- Run all paths -->
            <button
              onclick={() => {
                runMenuOpen = false;
                editorStore.runAllPaths();
              }}
              class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800/60"
            >
              <Layers size={12} class="shrink-0 text-zinc-400" />
              <div>
                <div class="font-medium">Run all paths</div>
              </div>
            </button>

            <div class="mx-3 border-t border-zinc-800/60"></div>

            <!-- Force recompile -->
            <button
              disabled={editorStore.isCompiling || editorStore.isRunning}
              onclick={() => {
                runMenuOpen = false;
                editorStore.compileCurrentTest({ autoRun: false });
              }}
              class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors
                {editorStore.isCompiling || editorStore.isRunning
                ? 'cursor-not-allowed text-zinc-600'
                : 'cursor-pointer text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300'}"
            >
              <RefreshCw size={12} class="shrink-0" />
              <div>
                <div class="font-medium">Regenerate</div>
              </div>
            </button>

            <div class="mx-3 border-t border-zinc-800/60"></div>

            <!-- Clear run status -->
            <button
              disabled={editorStore.isRunning}
              onclick={() => {
                runMenuOpen = false;
                editorStore.clearRunStates();
              }}
              class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors
                {editorStore.isRunning
                ? 'cursor-not-allowed text-zinc-600'
                : 'cursor-pointer text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300'}"
            >
              <X size={12} class="shrink-0" />
              <div>
                <div class="font-medium">Clear status</div>
              </div>
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
