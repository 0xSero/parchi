import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

type Workflow = { id: string; name: string; prompt: string; createdAt: number };

sidePanelProto.handleWorkflowKeydown = function handleWorkflowKeydown(event: KeyboardEvent): boolean {
  if (!this.workflowMenuOpen) return false;

  const active = document.activeElement;
  if (active && (active.id === 'workflowNameInput' || active.id === 'workflowPromptInput')) {
    return false;
  }

  const menu = document.getElementById('workflowMenu');
  if (!menu) return false;
  const items = menu.querySelectorAll('.workflow-item');
  const count = items.length;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    this.workflowMenuIndex = count > 0 ? (this.workflowMenuIndex + 1) % count : -1;
    this.updateWorkflowMenuHighlight(items);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    this.workflowMenuIndex = count > 0 ? (this.workflowMenuIndex - 1 + count) % count : -1;
    this.updateWorkflowMenuHighlight(items);
    return true;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (this.workflowMenuIndex >= 0 && this.workflowMenuIndex < count) {
      const id = (items[this.workflowMenuIndex] as HTMLElement).dataset.workflowId;
      const wf = this.workflows.find((w: Workflow) => w.id === id);
      if (wf) this.selectWorkflow(wf);
    }
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    this.hideWorkflowMenu();
    return true;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    if (this.workflowMenuIndex >= 0 && this.workflowMenuIndex < count) {
      const id = (items[this.workflowMenuIndex] as HTMLElement).dataset.workflowId;
      const wf = this.workflows.find((w: Workflow) => w.id === id);
      if (wf) this.selectWorkflow(wf);
    }
    return true;
  }
  return false;
};

sidePanelProto.updateWorkflowMenuHighlight = function updateWorkflowMenuHighlight(items: NodeListOf<Element>): void {
  items.forEach((item, i) => {
    if (i === this.workflowMenuIndex) {
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
};
