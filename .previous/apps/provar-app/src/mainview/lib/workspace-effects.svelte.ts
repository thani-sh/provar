import { editorStore } from "./stores/editor-store.svelte";
import { uiStore } from "./stores/ui-store.svelte";

/**
 * installWorkspaceEffects wires the cross-store layout effects that keep the
 * sidebars in sync with editor state. It should be called exactly once at
 * app startup. The effects are returned so the caller can hold them for
 * teardown (in practice Svelte 5 root effects live for the lifetime of the
 * app, but we return a teardown for completeness).
 *
 * Effects:
 *   1. When a node is selected, open the right sidebar and switch it to the
 *      "node" tab (closing assistant + config).
 *   2. When the active file changes, reset `lastOpenSidebar` to "config" so
 *      a fresh file opens with the config panel rather than a stale node
 *      selection.
 *   3. Auto-close the right sidebar when no panel is active, auto-open it
 *      when one becomes active.
 *   4. Auto-hide the left sidebar when a file is opened, auto-show it when
 *      the editor has no file.
 */
export function installWorkspaceEffects(): () => void {
  const teardowns: Array<() => void> = [];

  // (1) Selecting a node → open node sidebar, close others.
  teardowns.push(
    $effect.root(() => {
      $effect(() => {
        if (editorStore.selectedNodeId) {
          uiStore.lastOpenSidebar = "node";
          uiStore.isRightSidebarOpen = true;
          uiStore.isAssistantPanelOpen = false;
          uiStore.isConfigPanelOpen = false;
        }
      });
    }),
  );

  // (2) Switching files → reset lastOpenSidebar to "config".
  let prevFile: string | null = null;
  teardowns.push(
    $effect.root(() => {
      $effect(() => {
        const file = editorStore.selectedFilePath;
        if (file !== prevFile) {
          prevFile = file;
          uiStore.lastOpenSidebar = "config";
        }
      });
    }),
  );

  // (3) Sync right sidebar visibility with "any panel active".
  teardowns.push(
    $effect.root(() => {
      $effect(() => {
        const hasActivePanel =
          uiStore.isAssistantPanelOpen ||
          uiStore.isConfigPanelOpen ||
          (editorStore.selectedNode && editorStore.selectedNodeId);
        uiStore.isRightSidebarOpen = Boolean(hasActivePanel);
      });
    }),
  );

  // (4) Sync left sidebar visibility with "file open".
  teardowns.push(
    $effect.root(() => {
      $effect(() => {
        uiStore.isSidebarOpen = !editorStore.selectedFilePath;
      });
    }),
  );

  return () => {
    for (const t of teardowns) t();
  };
}
