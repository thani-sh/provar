class UIStore {
  isSidebarOpen = $state(true);
  isAssistantPanelOpen = $state(false);
  isConfigPanelOpen = $state(false);
  isInputModalOpen = $state(false);

  inputModalProps = $state({
    title: "",
    placeholder: "",
    type: "file" as "file" | "folder",
    parentPath: "",
  });

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

  toggleAssistant() {
    this.isSidebarOpen = true; // Automatically open sidebar if we show Assistant or Config
    this.isAssistantPanelOpen = !this.isAssistantPanelOpen;
    this.isConfigPanelOpen = false;
  }

  toggleConfig() {
    this.isSidebarOpen = true; // Automatically open sidebar if we show Assistant or Config
    this.isConfigPanelOpen = !this.isConfigPanelOpen;
    this.isAssistantPanelOpen = false;
  }

  closeAllPanels() {
    this.isAssistantPanelOpen = false;
    this.isConfigPanelOpen = false;
  }
}

export const uiStore = new UIStore();
