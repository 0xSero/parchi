/**
 * Event Handler - UI Module
 * UI element event handlers (chat, popovers, tabs, etc.)
 */

import { SidePanelUI } from '../panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up UI-related event listeners
 */
export const setupUIListeners = function setupUIListeners(this: SidePanelUI & Record<string, unknown>) {
  // Balance popover + mascot click
  const mascotCorner = document.getElementById('mascotCorner');
  const balancePopover = document.getElementById('balancePopover');
  const balancePopoverClose = document.getElementById('balancePopoverClose');

  // Mascot click toggles context inspector
  if (mascotCorner) {
    mascotCorner.addEventListener('click', (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      balancePopover?.classList.add('hidden');
      void this.toggleContextInspectorPopover?.();
    });
  }

  if (balancePopover) {
    balancePopoverClose?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      balancePopover.classList.add('hidden');
    });
    // Close popover when clicking outside
    document.addEventListener('click', (e: Event) => {
      const target = e.target as Node;
      const clickedMascot = mascotCorner?.contains(target) ?? false;
      if (!balancePopover.classList.contains('hidden') && !balancePopover.contains(target) && !clickedMascot) {
        balancePopover.classList.add('hidden');
      }
    });
  }

  // Context inspector
  this.elements.contextInspectorBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    void this.toggleContextInspectorPopover?.();
  });

  this.elements.contextInspectorCloseBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextInspectorPopover?.();
  });

  this.elements.contextInspectorCompactBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextInspectorPopover?.();
    void this.requestManualContextCompaction?.();
  });

  document.addEventListener('click', (event: Event) => {
    const popover = this.elements.contextInspectorPopover as HTMLElement | null;
    const button = mascotCorner || (this.elements.contextInspectorBtn as HTMLElement | null);
    const target = event.target as Node | null;
    if (!popover || popover.classList.contains('hidden') || !target) return;
    if (popover.contains(target)) return;
    if (button?.contains(target)) return;
    this.closeContextInspectorPopover?.();
  });

  // Model selector
  this.elements.modelSelect?.addEventListener('change', () => {
    void this.handleModelSelectChange();
  });
  this.elements.setupAccessBtn?.addEventListener('click', () => {
    void this.handleSetupAccessClick?.();
  });

  // File upload
  this.elements.fileBtn?.addEventListener('click', () => {
    this.elements.fileInput?.click();
  });
  this.elements.fileInput?.addEventListener('change', (event) => this.handleFileSelection(event));

  // Zoom controls
  this.elements.zoomInBtn?.addEventListener('click', () => this.adjustUiZoom(0.05));
  this.elements.zoomOutBtn?.addEventListener('click', () => this.adjustUiZoom(-0.05));
  this.elements.zoomResetBtn?.addEventListener('click', () => this.applyUiZoom(1));
  this.elements.uiZoom?.addEventListener('input', () => {
    const value = Number.parseFloat(this.elements.uiZoom.value || '1');
    this.applyUiZoom(value);
  });
  this.elements.fontPreset?.addEventListener('change', () => {
    this.applyTypography(this.elements.fontPreset?.value || 'default', this.fontStylePreset || 'normal');
  });
  this.elements.fontStylePreset?.addEventListener('change', () => {
    this.applyTypography(this.fontPreset || 'default', this.elements.fontStylePreset?.value || 'normal');
  });

  // Tab selector
  this.elements.tabSelectorBtn?.addEventListener('click', () => this.toggleTabSelector());
  this.elements.closeTabSelector?.addEventListener('click', () => this.closeTabSelector());
  this.elements.tabSelectorAddActive?.addEventListener('click', () => this.addActiveTabToSelection());
  this.elements.tabSelectorClear?.addEventListener('click', () => this.clearSelectedTabs());
  const tabBackdrop = this.elements.tabSelector?.querySelector('.modal-backdrop');
  tabBackdrop?.addEventListener('click', () => this.closeTabSelector());

  // Chat scroll
  this.elements.chatMessages?.addEventListener('scroll', () => this.handleChatScroll());

  // Delegated click: copy button inside code blocks
  this.elements.chatMessages?.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('.code-copy-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const wrap = btn.closest('.code-block-wrap');
    const code = wrap?.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent || '').then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    });
  });
  this.elements.scrollToLatestBtn?.addEventListener('click', () => this.scrollToBottom({ force: true }));

  // Note: Profile editor handlers are in event-handlers/profile.ts
};

sidePanelProto.setupUIListeners = setupUIListeners;
