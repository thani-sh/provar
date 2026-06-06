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
  import { workspaceStore } from "./lib/stores/WorkspaceStore.svelte";
  import { editorStore } from "./lib/stores/EditorStore.svelte";
  import { uiStore } from "./lib/stores/UIStore.svelte";
  import { registerRPCHandlers } from "./lib/api/rpc";

  import AssistantPanel, {
    type AssistantMessage,
  } from "./lib/components/feature/AssistantPanel.svelte";
  import Canvas from "./lib/components/feature/Canvas.svelte";
  import ConfigModal from "./lib/components/ui/ConfigModal.svelte";
  import ConfigPanel from "./lib/components/feature/ConfigPanel.svelte";
  import InputModal from "./lib/components/ui/InputModal.svelte";
  import NodeSidePanel from "./lib/components/feature/NodeSidePanel.svelte";
  import TestExplorer from "./lib/components/feature/TestExplorer.svelte";
  import ConfirmModal from "./lib/components/ui/ConfirmModal.svelte";
  import SettingsModal from "./lib/components/ui/SettingsModal.svelte";

  // Assistant State (keeping local as it's view-specific and transient)
  let assistantMessages = $state<AssistantMessage[]>([]);
  let assistantBusy = $state(false);
  let activeAssistantMsgId = $state<string | null>(null);

  let recentWorkspaces = $state<string[]>([]);
  let homeDir = $state("");
  let runMenuOpen = $state(false);

  $effect(() => {
    if (!workspaceStore.path) {
      ProvarAPI.getSettings()
        .then((res) => {
          recentWorkspaces = res.settings.recentWorkspaces || [];
          homeDir = res.home || "";
        })
        .catch((err) => {
          console.error("Failed to load settings recents:", err);
        });
    }
  });

  onMount(() => {
    workspaceStore.initialize();

    registerRPCHandlers({
      assistantChunk: ({ text, status }) => {
        if (!activeAssistantMsgId) return;
        assistantMessages = assistantMessages.map((msg) =>
          msg.id === activeAssistantMsgId
            ? { ...msg, content: msg.content + text, status }
            : msg,
        );
      },
      openSettings: () => {
        uiStore.isSettingsModalOpen = true;
      },
      settingsChanged: () => {
        ProvarAPI.getSettings()
          .then((res) => {
            recentWorkspaces = res.settings.recentWorkspaces || [];
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
      workspaceStore.refreshFiles();
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
      const res = await ProvarAPI.assistEditor(
        prompt,
        history,
        editorStore.selectedFilePath || undefined,
      );

      // Final replacement in case the RPC resolves with full message text
      assistantMessages = assistantMessages.map((msg) =>
        msg.id === assistantMsgId
          ? { ...msg, content: res.message || msg.content, status: "completed" }
          : msg,
      );

      if (res.action?.type === "selectFile") {
        await editorStore.loadFile(res.action.path);
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
  $effect(() => {
    const file = editorStore.selectedFilePath;
    uiStore.lastOpenSidebar = "config";
  });

  // Automatically close the right sidebar if no panel is active
  $effect(() => {
    const hasActivePanel =
      uiStore.isAssistantPanelOpen ||
      uiStore.isConfigPanelOpen ||
      (editorStore.selectedNode && editorStore.selectedNodeId);
    if (!hasActivePanel) {
      uiStore.isRightSidebarOpen = false;
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
    {#if workspaceStore.path}
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
              class="absolute top-[30px] right-0 z-50 min-w-[200px] overflow-hidden rounded-lg border border-zinc-800 bg-[#161b22] shadow-xl"
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
                  <div class="text-zinc-500">
                    Execute every branch sequentially
                  </div>
                </div>
              </button>

              <div class="mx-3 border-t border-zinc-800/60"></div>

              <!-- Run selected path -->
              <button
                disabled={editorStore.selectedNodePathIndex === null}
                onclick={() => {
                  runMenuOpen = false;
                  const idx = editorStore.selectedNodePathIndex;
                  if (idx !== null) editorStore.runPath(idx);
                }}
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors
                  {editorStore.selectedNodePathIndex !== null
                  ? 'cursor-pointer text-zinc-300 hover:bg-zinc-800/60'
                  : 'cursor-not-allowed text-zinc-600'}"
              >
                <Play
                  size={12}
                  class="shrink-0 {editorStore.selectedNodePathIndex !== null
                    ? 'text-zinc-400'
                    : 'text-zinc-700'}"
                />
                <div>
                  <div class="font-medium">Run selected path</div>
                  <div
                    class={editorStore.selectedNodePathIndex !== null
                      ? "text-zinc-500"
                      : "text-zinc-700"}
                  >
                    {editorStore.selectedNodePathIndex !== null
                      ? `Path ${editorStore.selectedNodePathIndex + 1} of ${editorStore.allPaths.length}`
                      : "Select a node first"}
                  </div>
                </div>
              </button>

              <!-- Run up to selected node -->
              <button
                disabled={editorStore.selectedNodeId === null ||
                  editorStore.selectedNodePathIndex === null}
                onclick={() => {
                  runMenuOpen = false;
                  const idx = editorStore.selectedNodePathIndex;
                  const nodeId = editorStore.selectedNodeId;
                  if (idx !== null && nodeId)
                    editorStore.runPathUpTo(idx, nodeId);
                }}
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors
                  {editorStore.selectedNodeId !== null &&
                editorStore.selectedNodePathIndex !== null
                  ? 'cursor-pointer text-zinc-300 hover:bg-zinc-800/60'
                  : 'cursor-not-allowed text-zinc-600'}"
              >
                <ArrowRightToLine
                  size={12}
                  class="shrink-0 {editorStore.selectedNodeId !== null
                    ? 'text-zinc-400'
                    : 'text-zinc-700'}"
                />
                <div>
                  <div class="font-medium">Run up to here</div>
                  <div
                    class={editorStore.selectedNodeId !== null
                      ? "text-zinc-500"
                      : "text-zinc-700"}
                  >
                    {editorStore.selectedNodeId !== null
                      ? "Stop at selected node"
                      : "Select a node first"}
                  </div>
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
                  <div class="font-medium">Clear run status</div>
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
    {#if !workspaceStore.path}
      <div
        class="flex h-full flex-col items-center justify-center space-y-4 text-zinc-500"
      >
        <div class="flex w-full max-w-sm flex-col items-center">
          {#if recentWorkspaces.length > 0}
            <h3
              class="mb-3 text-xs font-semibold tracking-wider text-zinc-600 uppercase"
            >
              Recent Workspaces
            </h3>
            <ul class="mb-3 w-full space-y-2">
              {#each recentWorkspaces as path}
                <li>
                  <button
                    onclick={async () => {
                      await ProvarAPI.openWorkspace(path);
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
              await ProvarAPI.selectWorkspace();
            }}
            class="w-full rounded-lg border border-zinc-800/80 bg-[#161b22]/50 px-4 py-3.5 text-center text-xs font-medium text-zinc-400 transition-all hover:border-zinc-700 hover:bg-[#21262d]/50 hover:text-zinc-200 focus:outline-none"
          >
            Open workspace folder...
          </button>
        </div>
      </div>
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

  {#if workspaceStore.path}
    <TestExplorer
      files={workspaceStore.tests}
      selectedFile={editorStore.selectedFilePath}
      onSelect={(path) => editorStore.loadFile(path)}
      onCreateFile={(parent) => uiStore.openInputModal("file", parent)}
      onCreateFolder={(parent) => uiStore.openInputModal("folder", parent)}
      onDelete={(path) => editorStore.deletePath(path)}
      onShowConfig={() => uiStore.toggleConfig()}
      onShowAI={() => uiStore.toggleAssistant()}
    />
  {/if}

  {#if uiStore.isRightSidebarOpen && (uiStore.isAssistantPanelOpen || uiStore.isConfigPanelOpen || (editorStore.selectedNode && editorStore.selectedNodeId))}
    <aside
      transition:fly={{ x: 400, duration: 200 }}
      class="absolute top-0 right-0 bottom-0 z-20 flex w-[400px] flex-col border-l border-zinc-800 bg-[#161b22]/50 pt-[4px] backdrop-blur-md"
    >
      {#if uiStore.isAssistantPanelOpen}
        <AssistantPanel
          onSend={handleAssist}
          selectedFile={editorStore.selectedFilePath}
          messages={assistantMessages}
          isBusy={assistantBusy}
        />
      {:else if uiStore.isConfigPanelOpen}
        <ConfigPanel
          config={workspaceStore.config}
          onSave={(cfg) => workspaceStore.saveConfig(cfg)}
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
    show={workspaceStore.isConfigModalOpen}
    onConfirm={(cfg) => workspaceStore.saveConfig(cfg)}
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
