class UIStore {
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

  toggleAssistant() {
    this.isAssistantPanelOpen = !this.isAssistantPanelOpen;
    this.isConfigPanelOpen = false;
  }

  toggleConfig() {
    this.isConfigPanelOpen = !this.isConfigPanelOpen;
    this.isAssistantPanelOpen = false;
  }

  closeAllPanels() {
    this.isAssistantPanelOpen = false;
    this.isConfigPanelOpen = false;
  }
}

export const uiStore = new UIStore();
