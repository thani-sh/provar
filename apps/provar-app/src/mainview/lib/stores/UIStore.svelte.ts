import { editorStore } from "./EditorStore.svelte";

class UIStore {
  isSidebarOpen = $state(true);
  isRightSidebarOpen = $state(true);
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
    }
  }

  restoreLastSidebar() {
    this.isRightSidebarOpen = true;
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
    this.isSidebarOpen = true; // Automatically open sidebar if we show Assistant or Config
    if (this.isAssistantPanelOpen) {
      this.isAssistantPanelOpen = false;
      this.isRightSidebarOpen = false;
    } else {
      this.isAssistantPanelOpen = true;
      this.isConfigPanelOpen = false;
      this.isRightSidebarOpen = true;
      this.lastOpenSidebar = "assistant";
    }
  }

  toggleConfig() {
    this.isSidebarOpen = true; // Automatically open sidebar if we show Assistant or Config
    if (this.isConfigPanelOpen) {
      this.isConfigPanelOpen = false;
      this.isRightSidebarOpen = false;
    } else {
      this.isConfigPanelOpen = true;
      this.isAssistantPanelOpen = false;
      this.isRightSidebarOpen = true;
      this.lastOpenSidebar = "config";
    }
  }

  closeAllPanels() {
    this.isAssistantPanelOpen = false;
    this.isConfigPanelOpen = false;
  }
}

export const uiStore = new UIStore();
