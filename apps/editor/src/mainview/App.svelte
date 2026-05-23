<script lang="ts">
  import { onMount } from "svelte";
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

  // Assistant State (keeping local as it's view-specific and transient)
  let assistantMessages = $state<AssistantMessage[]>([]);
  let assistantBusy = $state(false);
  let activeAssistantMsgId = $state<string | null>(null);

  onMount(() => {
    workspaceStore.initialize();

    registerRPCHandlers({
      assistantChunk: ({ text, status }) => {
        if (!activeAssistantMsgId) return;
        assistantMessages = assistantMessages.map((msg) =>
          msg.id === activeAssistantMsgId
            ? { ...msg, content: msg.content + text, status }
            : msg
        );
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
        editorStore.selectedFilePath || undefined,
      );

      // Final replacement in case the RPC resolves with full message text
      assistantMessages = assistantMessages.map((msg) =>
        msg.id === assistantMsgId
          ? { ...msg, content: res.message, status: "completed" }
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
</script>

<div
  class="relative h-screen w-full overflow-hidden overscroll-none bg-[#0e1116] font-sans text-zinc-300"
>
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="absolute inset-0 touch-none overscroll-none"
    onclick={() => uiStore.closeAllPanels()}
    role="button"
    tabindex="-1"
  >
    {#if !workspaceStore.path}
      <div
        class="flex h-full flex-col items-center justify-center space-y-4 text-zinc-500"
      >
        <p class="text-xl">Open a workspace to get started</p>
        <div class="flex items-center space-x-2 text-sm text-zinc-600">
          <kbd
            class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono"
            >Cmd/Ctrl + O</kbd
          >
          <span>to open a folder</span>
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
</div>
