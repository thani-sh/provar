<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import {
    File,
    Play,
    ChevronDown,
    Layers,
    ArrowRightToLine,
    X,
    Hammer,
    RefreshCw,
  } from "lucide-svelte";
  import { ProvarAPI } from "./lib/api/provar";
  import { projectStore } from "./lib/stores/project-store.svelte";
  import { editorStore } from "./lib/stores/editor-store.svelte";
  import { uiStore } from "./lib/stores/ui-store.svelte";
  import { registerRPCHandlers } from "./lib/api/rpc";

  import AssistantPanel, {
    type AssistantMessage,
  } from "./lib/components/feature/assistant-panel.svelte";
  import Canvas from "./lib/components/feature/Canvas.svelte";
  import ConfigModal from "./lib/components/ui/config-modal.svelte";
  import ConfigPanel from "./lib/components/feature/config-panel.svelte";
  import InputModal from "./lib/components/ui/input-modal.svelte";
  import NodeSidePanel from "./lib/components/feature/node-side-panel.svelte";
  import TestExplorer from "./lib/components/feature/test-explorer.svelte";
  import ConfirmModal from "./lib/components/ui/confirm-modal.svelte";
  import SettingsModal from "./lib/components/ui/settings-modal.svelte";

  // Assistant State (keeping local as it's view-specific and transient)
  let assistantMessages = $state<AssistantMessage[]>([]);
  let assistantBusy = $state(false);
  let activeAssistantMsgId = $state<string | null>(null);

  let recentProjects = $state<string[]>([]);
  let homeDir = $state("");
  let runMenuOpen = $state(false);

  $effect(() => {
    if (!projectStore.path) {
      ProvarAPI.getSettings()
        .then((res) => {
          recentProjects = res.settings.recentProjects || [];
          homeDir = res.home || "";
        })
        .catch((err) => {
          console.error("Failed to load settings recents:", err);
        });
    }
  });

  onMount(() => {
    projectStore.initialize();

    registerRPCHandlers({
      openSettings: () => {
        uiStore.isSettingsModalOpen = true;
      },
      settingsChanged: () => {
        ProvarAPI.getSettings()
          .then((res) => {
            recentProjects = res.settings.recentProjects || [];
            homeDir = res.home || "";
          })
          .catch((err) => {
            console.error(
              "Failed to load settings recents on settingsChanged:",
              err,
            );
          });
      },
    });

    const refreshInterval = setInterval(() => {
      projectStore.refreshFiles();
    }, 30000);

    return () => clearInterval(refreshInterval);
  });

  async function handleModalConfirm(name: string) {
    uiStore.isInputModalOpen = false;
    if (!name) return;

    const { type, parentPath } = uiStore.inputModalProps;

    try {
      let dir = parentPath.endsWith(".yml")
        ? parentPath.split("/").slice(0, -1).join("/")
        : parentPath;

      if (type === "file") {
        if (!dir.startsWith(".provar/tests")) {
          dir = ".provar/tests";
        }
        await editorStore.createFile(dir, name);
      } else {
        await editorStore.createDirectory(`${dir}/${name}`);
      }
    } catch (e) {
      console.error("App: Failed to create item:", e);
    }
  }

  async function handleAssist(prompt: string) {
    if (assistantBusy) return;

    // Capture conversation history prior to this turn
    const history = assistantMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantMsgId = Math.random().toString(36).substring(7);
    activeAssistantMsgId = assistantMsgId;
    assistantMessages = [
      ...assistantMessages,
      {
        id: Math.random().toString(36).substring(7),
        role: "user",
        content: prompt,
        status: "completed",
      },
      { id: assistantMsgId, role: "assistant", content: "", status: "pending" },
    ];

    assistantBusy = true;

    try {
      const stream = ProvarAPI.assistEditor(
        prompt,
        history,
        editorStore.selectedFilePath || undefined,
      );

      let fullResponseText = "";
      for await (const chunk of stream) {
        fullResponseText += chunk.text;
        assistantMessages = assistantMessages.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: fullResponseText, status: chunk.status }
            : msg,
        );
      }
    } catch (e) {
      console.error("App: AI Assist failed:", e);
      assistantMessages = assistantMessages.map((msg) =>
        msg.id === assistantMsgId
          ? {
              ...msg,
              content: "Sorry, I encountered an error. Please try again.",
              status: "error",
            }
          : msg,
      );
    } finally {
      assistantBusy = false;
    }
  }

  // Automatically open the right sidebar when a node is selected, and close assistant/config
  $effect(() => {
    if (editorStore.selectedNodeId) {
      uiStore.lastOpenSidebar = "node";
      uiStore.isRightSidebarOpen = true;
      uiStore.isAssistantPanelOpen = false;
      uiStore.isConfigPanelOpen = false;
    }
  });

  // Automatically reset the last open sidebar to config when switching files
  let prevFile = $state<string | null>(null);
  $effect(() => {
    const file = editorStore.selectedFilePath;
    if (file !== prevFile) {
      prevFile = file;
      uiStore.lastOpenSidebar = "config";
    }
  });

  // Automatically close the right sidebar if no panel is active
  $effect(() => {
    const hasActivePanel =
      uiStore.isAssistantPanelOpen ||
      uiStore.isConfigPanelOpen ||
      (editorStore.selectedNode && editorStore.selectedNodeId);
    if (!hasActivePanel) {
      uiStore.isRightSidebarOpen = false;
    } else {
      uiStore.isRightSidebarOpen = true;
    }
  });

  // Automatically hide the left sidebar when a file is opened, and show it when closed
  $effect(() => {
    if (editorStore.selectedFilePath) {
      uiStore.isSidebarOpen = false;
    } else {
      uiStore.isSidebarOpen = true;
    }
  });
</script>

<div
  class="relative h-screen w-full overflow-hidden overscroll-none bg-[#0e1116] font-sans text-zinc-300"
>
  <div
    class="electrobun-webkit-app-region-drag absolute top-0 right-0 left-0 z-40 h-[28px]"
  >
    {#if projectStore.path}
      <button
        onclick={() => uiStore.toggleSidebar()}
        class="electrobun-webkit-app-region-no-drag pointer-events-auto absolute top-[2px] left-[65px] flex h-6 w-6 items-center justify-center text-zinc-300 opacity-60 transition-opacity hover:opacity-100 focus:outline-none"
        title={uiStore.isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
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

  {#if editorStore.selectedFilePath}
    <div
      class="absolute top-[8px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2"
    >
      <button
        onclick={() => uiStore.toggleSidebar()}
        class="electrobun-webkit-app-region-no-drag pointer-events-auto flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800/80 bg-[#161b22]/80 px-3 py-1 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur-sm transition-all duration-300 select-none hover:border-zinc-700/90 hover:bg-[#21262d]/90 focus:ring-1 focus:ring-zinc-700 focus:outline-none"
        title={uiStore.isSidebarOpen
          ? "Hide Test Explorer"
          : "Show Test Explorer"}
      >
        <File class="h-3.5 w-3.5 text-blue-400" />
        <span class="tracking-wide"
          >{editorStore.selectedFilePath.replace(
            /^\.provar\/tests\//,
            "",
          )}</span
        >
      </button>

      {#if editorStore.isCompiling}
        <div
          class="electrobun-webkit-app-region-no-drag pointer-events-auto flex h-[26px] items-center gap-1.5 rounded-full border border-zinc-800/80 bg-[#161b22]/80 px-3 py-1 text-xs text-zinc-400 shadow-sm backdrop-blur-sm"
        >
          <div
            class="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-blue-500"
          ></div>
          <span>Compiling...</span>
        </div>
      {:else if !editorStore.currentFile?.code}
        <button
          onclick={() => editorStore.compileCurrentTest()}
          class="electrobun-webkit-app-region-no-drag pointer-events-auto flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border border-zinc-800/80 bg-[#161b22]/80 px-3 py-1 text-xs font-medium text-zinc-400 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-blue-500/80 hover:bg-[#21262d]/90 hover:text-blue-400 focus:outline-none"
          title="Compiled TypeScript file not found. Click to compile."
        >
          <Hammer size={11} class="shrink-0" />
          <span>Compile</span>
        </button>
      {:else if !editorStore.currentFile.code.valid}
        <button
          onclick={() => editorStore.compileCurrentTest()}
          class="electrobun-webkit-app-region-no-drag pointer-events-auto flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border border-amber-900/50 bg-[#161b22]/80 px-3 py-1 text-xs font-medium text-amber-500 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-amber-500/80 hover:bg-[#21262d]/90 hover:text-amber-400 focus:outline-none"
          title="Test file changed since last compilation. Click to recompile."
        >
          <RefreshCw size={11} class="shrink-0" />
          <span>Recompile</span>
        </button>
      {:else if editorStore.isRunning}
        <div
          class="electrobun-webkit-app-region-no-drag pointer-events-auto flex h-[26px] w-[26px] items-center justify-center rounded-full border border-zinc-800/80 bg-[#161b22]/80 shadow-sm backdrop-blur-sm"
        >
          <div
            class="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-blue-500"
          ></div>
        </div>
      {:else}
        <div
          class="electrobun-webkit-app-region-no-drag pointer-events-auto relative flex"
        >
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

  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="absolute inset-0 touch-none overscroll-none"
    onclick={() => {
      uiStore.closeAllPanels();
      runMenuOpen = false;
    }}
    role="button"
    tabindex="-1"
  >
    {#if !projectStore.path}
      <div
        class="flex h-full flex-col items-center justify-center space-y-4 text-zinc-500"
      >
        <div class="flex w-full max-w-sm flex-col items-center">
          {#if recentProjects.length > 0}
            <h3
              class="mb-3 text-xs font-semibold tracking-wider text-zinc-600 uppercase"
            >
              Recent Projects
            </h3>
            <ul class="mb-3 w-full space-y-2">
              {#each recentProjects as path}
                <li>
                  <button
                    onclick={async () => {
                      await ProvarAPI.openProject({ path });
                    }}
                    class="w-full truncate rounded-lg border border-zinc-800/80 bg-[#161b22]/50 px-4 py-2.5 text-left text-xs text-zinc-400 transition-all hover:border-zinc-700 hover:bg-[#21262d]/50 hover:text-zinc-200 focus:outline-none"
                    title={path}
                  >
                    <span class="font-medium text-zinc-300"
                      >{path.split("/").pop()}</span
                    >
                    <span
                      class="mt-0.5 block truncate text-[10px] text-zinc-500"
                    >
                      {homeDir && path.startsWith(homeDir)
                        ? path.replace(homeDir, "~")
                        : path}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}

          <button
            onclick={async () => {
              await ProvarAPI.selectProject();
            }}
            class="w-full rounded-lg border border-zinc-800/80 bg-[#161b22]/50 px-4 py-3.5 text-center text-xs font-medium text-zinc-400 transition-all hover:border-zinc-700 hover:bg-[#21262d]/50 hover:text-zinc-200 focus:outline-none"
          >
            Open project...
          </button>
        </div>
      </div>
    {:else}
      <Canvas
        testFile={editorStore.currentFile}
        bind:selectedNodeId={editorStore.selectedNodeId}
        onAddNode={(from, to) => editorStore.addNode(from, to)}
      />
      {#if !editorStore.currentFile}
        <div
          class="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-500"
        >
          <p>Select a test to begin</p>
        </div>
      {/if}
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

  {#if uiStore.isRightSidebarOpen && uiStore.isAssistantPanelOpen}
    <aside
      transition:fly={{ x: 400, duration: 200 }}
      class="absolute top-0 right-0 bottom-0 z-20 flex w-[400px] flex-col border-l border-zinc-800 bg-[#161b22]/50 pt-[4px] backdrop-blur-md"
    >
      <AssistantPanel
        onSend={handleAssist}
        selectedFile={editorStore.selectedFilePath}
        messages={assistantMessages}
        isBusy={assistantBusy}
      />
    </aside>
  {/if}

  {#if uiStore.isRightSidebarOpen && (uiStore.isConfigPanelOpen || (editorStore.selectedNode && editorStore.selectedNodeId))}
    <aside
      transition:fly={{ x: 400, duration: 200 }}
      class="absolute top-0 right-0 bottom-0 z-20 flex w-[400px] flex-col border-l border-zinc-800 bg-[#161b22]/50 pt-[4px] backdrop-blur-md"
    >
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

  <InputModal
    show={uiStore.isInputModalOpen}
    title={uiStore.inputModalProps.title}
    placeholder={uiStore.inputModalProps.placeholder}
    onConfirm={handleModalConfirm}
    onCancel={() => (uiStore.isInputModalOpen = false)}
  />

  <ConfigModal
    show={projectStore.isConfigModalOpen}
    onConfirm={(cfg) => projectStore.saveConfig(cfg)}
  />

  <ConfirmModal
    show={uiStore.isConfirmModalOpen}
    title={uiStore.confirmModalProps.title}
    message={uiStore.confirmModalProps.message}
    onConfirm={() => {
      uiStore.confirmModalProps.onConfirm();
      uiStore.isConfirmModalOpen = false;
    }}
    onCancel={() => (uiStore.isConfirmModalOpen = false)}
  />

  <SettingsModal
    show={uiStore.isSettingsModalOpen}
    onClose={() => (uiStore.isSettingsModalOpen = false)}
  />
</div>
