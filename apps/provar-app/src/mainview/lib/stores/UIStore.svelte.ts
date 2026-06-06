import { editorStore } from "./EditorStore.svelte";

class UIStore {
  isSidebarOpen = $state(true);
  isRightSidebarOpen = $state(false);
  isAssistantPanelOpen = $state(false);
  isConfigPanelOpen = $state(false);
  isInputModalOpen = $state(false);
  isConfirmModalOpen = $state(false);
  isSettingsModalOpen = $state(false);

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

  openConfirmModal(title: string, message: string, onConfirm: () => void) {
    this.confirmModalProps = {
      title,
      message,
      onConfirm,
    };
    this.isConfirmModalOpen = true;
  }

  openInputModal(type: "file" | "folder", parentPath: string) {
    this.inputModalProps = {
      type,
      parentPath,
      title: type === "file" ? "New test" : "New Folder",
      placeholder:
        type === "file" ? "Enter test name..." : "Enter folder name...",
    };
    this.isInputModalOpen = true;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleRightSidebar() {
    this.isRightSidebarOpen = !this.isRightSidebarOpen;
    if (this.isRightSidebarOpen) {
      this.restoreLastSidebar();
    } else {
      this.isAssistantPanelOpen = false;
      this.isConfigPanelOpen = false;
    }
  }

  restoreLastSidebar() {
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
        // Fallback to config
        this.lastOpenSidebar = "config";
        this.isConfigPanelOpen = true;
        this.isAssistantPanelOpen = false;
      }
    }
  }

  toggleAssistant() {
    if (this.isAssistantPanelOpen) {
      this.isAssistantPanelOpen = false;
    } else {
      this.isAssistantPanelOpen = true;
      this.isConfigPanelOpen = false;
      this.lastOpenSidebar = "assistant";
    }
  }

  toggleConfig() {
    if (this.isConfigPanelOpen) {
      this.isConfigPanelOpen = false;
    } else {
      this.isConfigPanelOpen = true;
      this.isAssistantPanelOpen = false;
      this.lastOpenSidebar = "config";
    }
  }

  closeAllPanels() {
    this.isAssistantPanelOpen = false;
    this.isConfigPanelOpen = false;
  }
}

export const uiStore = new UIStore();
