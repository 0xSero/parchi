import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

type Workflow = { id: string; name: string; prompt: string; createdAt: number };

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

sidePanelProto.showWorkflowMenu = function showWorkflowMenu(filter: string): void {
  let menu = document.getElementById('workflowMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'workflowMenu';
    menu.className = 'workflow-menu';
    document.body.appendChild(menu);
  }

  const composerEl = this.elements.composer as HTMLElement | null;
  if (composerEl) {
    const rect = composerEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
  }

  const query = filter.toLowerCase();
  const filtered: Workflow[] = query
    ? this.workflows.filter((w: Workflow) => w.name.toLowerCase().includes(query))
    : this.workflows;

  if (this.workflowMenuIndex >= filtered.length) this.workflowMenuIndex = filtered.length - 1;
  if (this.workflowMenuIndex < 0 && filtered.length > 0) this.workflowMenuIndex = 0;

  let listHtml = '';
  if (filtered.length === 0 && this.workflows.length === 0) {
    listHtml =
      '<div class="workflow-empty">No workflows yet. Type a prompt, then use <strong>/</strong> to save it.</div>';
  } else if (filtered.length === 0) {
    listHtml = '<div class="workflow-empty">No matching workflows</div>';
  } else {
    filtered.forEach((w: Workflow, i: number) => {
      const active = i === this.workflowMenuIndex ? ' active' : '';
      const preview = w.prompt.length > 50 ? w.prompt.slice(0, 50) + '…' : w.prompt;
      listHtml += `<div class="workflow-item${active}" data-workflow-id="${w.id}">
        <div class="workflow-item-text">
          <span class="workflow-item-name">/${w.name}</span>
          <span class="workflow-item-preview">${escapeHtml(preview)}</span>
        </div>
        <button class="workflow-item-delete" data-delete-id="${w.id}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>`;
    });
  }

  menu.innerHTML = `
    <div class="workflow-menu-list">${listHtml}</div>
    <div class="workflow-save-row" id="workflowSaveRow">
      <button class="workflow-save-btn" id="workflowSaveBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
        Save as workflow…
      </button>
    </div>
  `;
  this.workflowMenuOpen = true;

  // Bind list items
  menu.querySelectorAll('.workflow-item').forEach((item: Element) => {
    item.addEventListener('click', (e: Event) => {
      const deleteBtn = (e.target as HTMLElement).closest('.workflow-item-delete');
      if (deleteBtn) {
        e.stopPropagation();
        const deleteId = (deleteBtn as HTMLElement).dataset.deleteId;
        if (deleteId) {
          this.deleteWorkflow(deleteId).then(() => {
            const input = this.elements.userInput?.value || '';
            this.showWorkflowMenu(input.startsWith('/') ? input.slice(1) : '');
          });
        }
        return;
      }
      const id = (item as HTMLElement).dataset.workflowId;
      const wf = this.workflows.find((w: Workflow) => w.id === id);
      if (wf) this.selectWorkflow(wf);
    });
  });

  menu.querySelector('#workflowSaveBtn')?.addEventListener('click', () => this.showWorkflowSaveInput());

  // Outside-click dismissal
  this._workflowOutsideHandler =
    this._workflowOutsideHandler ||
    ((e: MouseEvent) => {
      const menuEl = document.getElementById('workflowMenu');
      const inputEl = this.elements.userInput;
      if (menuEl && !menuEl.contains(e.target as Node) && e.target !== inputEl) {
        this.hideWorkflowMenu();
      }
    });
  document.removeEventListener('mousedown', this._workflowOutsideHandler);
  document.addEventListener('mousedown', this._workflowOutsideHandler);
};

sidePanelProto.hideWorkflowMenu = function hideWorkflowMenu(): void {
  const menu = document.getElementById('workflowMenu');
  menu?.remove();
  this.workflowMenuOpen = false;
  this.workflowMenuIndex = -1;
  if (this._workflowOutsideHandler) {
    document.removeEventListener('mousedown', this._workflowOutsideHandler);
  }
};

sidePanelProto.handleWorkflowInput = function handleWorkflowInput(): void {
  const userInput = this.elements.userInput;
  if (!userInput) return;
  const value = userInput.value;
  if (value.startsWith('/')) {
    this.showWorkflowMenu(value.slice(1));
  } else if (this.workflowMenuOpen) {
    this.hideWorkflowMenu();
  }
};

sidePanelProto.selectWorkflow = function selectWorkflow(workflow: Workflow): void {
  const userInput = this.elements.userInput;
  if (!userInput) return;
  const computedMaxHeight = Number.parseFloat(getComputedStyle(userInput).maxHeight);
  const maxHeight = Number.isFinite(computedMaxHeight) && computedMaxHeight > 0 ? computedMaxHeight : 280;
  userInput.value = workflow.prompt;
  userInput.style.height = 'auto';
  const nextHeight = Math.min(userInput.scrollHeight, maxHeight);
  userInput.style.height = `${nextHeight}px`;
  userInput.style.overflowY = userInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
  userInput.focus();
  this.hideWorkflowMenu();
};
