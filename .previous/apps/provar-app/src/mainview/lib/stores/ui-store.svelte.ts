import { editorStore } from "./editor-store.svelte";

/**
 * UIStore manages the visibility state of panels, sidebars, modals, and window layouts.
 */
class UIStore {
  isSidebarOpen = $state(true);
  isRightSidebarOpen = $state(false);
  isAssistantPanelOpen = $state(false);
  isConfigPanelOpen = $state(false);
  isInputModalOpen = $state(false);
  isConfirmModalOpen = $state(false);
  isSettingsModalOpen = $state(false);

  /**
   * toast is a non-blocking error/info message. `null` when no toast is showing. Replaces the
   * ad-hoc `console.error` pattern for user-visible failures.
   */
  toast = $state<{
    id: number;
    kind: "error" | "info";
    message: string;
  } | null>(null);

  lastOpenSidebar = $state<"assistant" | "config" | "node">("config");

  inputModalProps = $state({
    title: "",
    placeholder: "",
    type: "file" as "file" | "folder",
    parentPath: "",
  });

  confirmModalProps = $state({
    title: "",
    message: "",
    onConfirm: () => {},
  });

  /**
   * showToast displays a non-blocking message for 4 seconds. New toasts replace the current one
   * and reset the timer.
   */
  showToast(kind: "error" | "info", message: string): void {
    const id = Date.now();
    this.toast = { id, kind, message };
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null;
    }, 4000);
  }

  /**
   * openConfirmModal triggers the global confirmation dialog with the given message.
   */
  openConfirmModal(
    title: string,
    message: string,
    onConfirm: () => void,
  ): void {
    this.confirmModalProps = {
      title,
      message,
      onConfirm,
    };
    this.isConfirmModalOpen = true;
  }

  /**
   * openInputModal triggers the file or directory creation input modal.
   */
  openInputModal(type: "file" | "folder", parentPath: string): void {
    this.inputModalProps = {
      type,
      parentPath,
      title: type === "file" ? "New test" : "New Folder",
      placeholder:
        type === "file" ? "Enter test name..." : "Enter folder name...",
    };
    this.isInputModalOpen = true;
  }

  /**
   * toggleSidebar opens or closes the primary explorer sidebar.
   */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * toggleRightSidebar displays or hides the utility side panel.
   */
  toggleRightSidebar(): void {
    this.isRightSidebarOpen = !this.isRightSidebarOpen;
    if (this.isRightSidebarOpen) {
      this.restoreLastSidebar();
    } else {
      this.isAssistantPanelOpen = false;
      this.isConfigPanelOpen = false;
    }
  }

  /**
   * restoreLastSidebar restores the active tab configuration of the side panel.
   */
  restoreLastSidebar(): void {
    if (this.lastOpenSidebar === "assistant") {
      this.isAssistantPanelOpen = true;
      this.isConfigPanelOpen = false;
    } else if (this.lastOpenSidebar === "config") {
      this.isConfigPanelOpen = true;
      this.isAssistantPanelOpen = false;
    } else if (this.lastOpenSidebar === "node") {
      const hasSelectedNode = editorStore.selectedNodeId !== null;
      if (hasSelectedNode) {
        this.isAssistantPanelOpen = false;
        this.isConfigPanelOpen = false;
      } else {
        this.lastOpenSidebar = "config";
        this.isConfigPanelOpen = true;
        this.isAssistantPanelOpen = false;
      }
    }
  }

  /**
   * toggleAssistant opens or closes the AI Assistant tab.
   */
  toggleAssistant(): void {
    if (this.isAssistantPanelOpen) {
      this.isAssistantPanelOpen = false;
    } else {
      this.isAssistantPanelOpen = true;
      this.isConfigPanelOpen = false;
      this.lastOpenSidebar = "assistant";
    }
  }

  /**
   * toggleConfig opens or closes the configuration settings tab.
   */
  toggleConfig(): void {
    if (this.isConfigPanelOpen) {
      this.isConfigPanelOpen = false;
    } else {
      this.isConfigPanelOpen = true;
      this.isAssistantPanelOpen = false;
      this.lastOpenSidebar = "config";
    }
  }

  /**
   * closeAllPanels closes all active slide-over panels.
   */
  closeAllPanels(): void {
    this.isAssistantPanelOpen = false;
    this.isConfigPanelOpen = false;
  }
}

/**
 * uiStore is the shared reactive state instance of UIStore.
 */
export const uiStore = new UIStore();
