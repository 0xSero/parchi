import type { RunPlan } from '@parchi/shared';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

/**
 * Initialize plan drawer event listeners
 */
sidePanelProto.setupPlanDrawer = function setupPlanDrawer() {
  this.elements.planDrawerToggle?.addEventListener('click', (e: MouseEvent) => {
    // Don't toggle if clicking on action buttons
    if ((e.target as HTMLElement).closest('.plan-drawer-actions')) return;
    this.togglePlanDrawer();
  });

  this.elements.planClearBtn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    this.clearPlan();
  });
};

/**
 * Toggle the plan drawer collapsed state
 */
sidePanelProto.togglePlanDrawer = function togglePlanDrawer() {
  const drawer = this.elements.planDrawer;
  drawer?.classList.toggle('collapsed');
  if (drawer) {
    const expanded = !drawer.classList.contains('collapsed');
    drawer.dataset.userExpanded = String(expanded);
  }
};

/**
 * Show the plan drawer
 */
sidePanelProto.showPlanDrawer = function showPlanDrawer() {
  this.elements.planDrawer?.classList.remove('hidden');
};

/**
 * Hide the plan drawer
 */
sidePanelProto.hidePlanDrawer = function hidePlanDrawer() {
  this.elements.planDrawer?.classList.add('hidden');
};

/**
 * Clear the current plan
 */
sidePanelProto.clearPlan = function clearPlan() {
  this.currentPlan = null;
  this.hidePlanDrawer();
  if (this.elements.planChecklist) {
    this.elements.planChecklist.innerHTML = '';
  }
};

/**
 * Render the plan to the drawer
 */
sidePanelProto.renderPlanDrawer = function renderPlanDrawer(plan: RunPlan) {
  if (!plan || !plan.steps || plan.steps.length === 0) {
    this.hidePlanDrawer();
    return;
  }

  const steps = plan.steps;
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const isComplete = totalCount > 0 && completedCount === totalCount;

  // Update step count
  if (this.elements.planStepCount) {
    this.elements.planStepCount.textContent =
      completedCount === totalCount ? `${totalCount} steps · Done` : `${completedCount}/${totalCount} steps`;
  }

  // Render checklist
  if (this.elements.planChecklist) {
    this.elements.planChecklist.innerHTML = steps
      .map((step, index) => {
        const isDone = step.status === 'done';
        const isBlocked = step.status === 'blocked';

        // Determine if this step can be checked (previous steps must be done)
        const previousStepsDone = steps.slice(0, index).every((s) => s.status === 'done');
        const canCheck = !isDone && previousStepsDone && !isBlocked;
        const isCurrent = !isDone && previousStepsDone && !isBlocked;

        const itemClass = [
          'plan-checklist-item',
          isDone ? 'completed' : '',
          isCurrent ? 'current' : '',
          isBlocked ? 'blocked' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const checkboxClass = ['plan-checklist-checkbox', isDone ? 'checked' : ''].filter(Boolean).join(' ');

        const notes = step.notes ? `<div class="plan-checklist-notes">${this.escapeHtml(step.notes)}</div>` : '';

        return `
          <li class="${itemClass}" data-step-index="${index}" data-step-id="${step.id}">
            <button
              class="${checkboxClass}"
              ${!canCheck && !isDone ? 'disabled' : ''}
              data-action="toggle-step"
              data-step-index="${index}"
              title="${isDone ? 'Completed' : canCheck ? 'Mark as done' : 'Complete previous steps first'}"
            ></button>
            <div class="plan-checklist-content">
              <div class="plan-checklist-title">${this.escapeHtml(step.title)}</div>
              ${notes}
            </div>
          </li>
        `;
      })
      .join('');

    // Add click handlers for checkboxes
    this.elements.planChecklist.querySelectorAll('[data-action="toggle-step"]').forEach((btn: Element) => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const index = Number.parseInt((btn as HTMLElement).dataset.stepIndex || '0', 10);
        this.togglePlanStep(index);
      });
    });
  }

  this.showPlanDrawer();
  if (this.elements.planDrawer) {
    // Always start collapsed; expand only if user manually opened it
    if (this.elements.planDrawer.dataset.userExpanded !== 'true') {
      this.elements.planDrawer.classList.add('collapsed');
    }
    if (isComplete) {
      this.elements.planDrawer.classList.add('collapsed');
      this.elements.planDrawer.dataset.userExpanded = 'false';
    }
  }
};

/**
 * Toggle a plan step's completion status
 */
sidePanelProto.togglePlanStep = function togglePlanStep(index: number) {
  if (!this.currentPlan || !this.currentPlan.steps[index]) return;

  const step = this.currentPlan.steps[index];
  const previousStepsDone = this.currentPlan.steps
    .slice(0, index)
    .every((s: { status: string }) => s.status === 'done');

  // Can only toggle if previous steps are done
  if (!previousStepsDone && step.status !== 'done') {
    this.updateStatus('Complete previous steps first', 'warning');
    return;
  }

  // Toggle the step
  if (step.status === 'done') {
    // Unchecking - also uncheck all subsequent steps
    for (let i = index; i < this.currentPlan.steps.length; i++) {
      if (this.currentPlan.steps[i].status === 'done') {
        this.currentPlan.steps[i].status = 'pending';
      }
    }
  } else {
    step.status = 'done';
  }

  this.currentPlan.updatedAt = Date.now();
  this.renderPlanDrawer(this.currentPlan);
};
