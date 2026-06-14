<script lang="ts">
  import { editorStore } from "../../stores/editor-store.svelte";
  import { projectStore } from "../../stores/project-store.svelte";
  import { uiStore } from "../../stores/ui-store.svelte";
  import ConfigModal from "../ui/config-modal.svelte";
  import ConfirmModal from "../ui/confirm-modal.svelte";
  import InputModal from "../ui/input-modal.svelte";
  import SettingsModal from "../ui/settings-modal.svelte";

  /**
   * handleModalConfirm bridges the InputModal's name input to the right
   * editorStore action. It also normalises the parent path: when the user
   * right-clicks a .yml file the parent is the file itself, but new files
   * and folders live one level up.
   */
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
      console.error("AppModals: Failed to create item:", e);
    }
  }
</script>

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

{#if uiStore.toast}
  <div
    class="pointer-events-none fixed right-4 bottom-4 z-[300] flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-2xl backdrop-blur-md transition-all {uiStore
      .toast.kind === 'error'
      ? 'border-red-500/40 bg-red-950/80 text-red-200'
      : 'border-zinc-700 bg-zinc-900/80 text-zinc-200'}"
    role="status"
    aria-live="polite"
    data-testid="app-toast"
  >
    <span class="font-mono text-[10px] tracking-wider uppercase opacity-70"
      >{uiStore.toast.kind}</span
    >
    <span>{uiStore.toast.message}</span>
  </div>
{/if}
