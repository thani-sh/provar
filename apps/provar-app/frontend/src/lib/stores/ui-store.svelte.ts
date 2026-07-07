/**
 * UIStore manages the visibility state of panels, sidebars, modals, and
 * transient messages. One state field per concern — no boolean explosion.
 */

export type ModalKind = 'confirm' | 'input' | 'settings' | 'config' | null;
export type RightPanelTab = 'config' | 'assistant';

export interface Toast {
  id: number;
  kind: 'error' | 'info';
  message: string;
}

class UIStore {
  isSidebarOpen = $state(true);
  isRightSidebarOpen = $state(false);
  rightPanelTab = $state<RightPanelTab>('config');
  modalKind = $state<ModalKind>(null);
  toast = $state<Toast | null>(null);

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleRightSidebar() {
    this.isRightSidebarOpen = !this.isRightSidebarOpen;
  }

  openRightPanel(tab: RightPanelTab) {
    this.rightPanelTab = tab;
    this.isRightSidebarOpen = true;
  }

  showToast(kind: 'error' | 'info', message: string) {
    const id = Date.now();
    this.toast = { id, kind, message };
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null;
    }, 4000);
  }
}

export const uiStore = new UIStore();