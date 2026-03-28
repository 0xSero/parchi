import {
  escapeAttribute,
  escapeHtml,
  escapeHtmlBasic,
  safeJsonStringify as safeJsonStringifyFn,
  truncate,
} from '@parchi/shared';
import { SidePanelUI } from './panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.safeJsonStringify = (value: unknown) => safeJsonStringifyFn(value);

sidePanelProto.truncateText = function truncateText(text: string, limit = 1200) {
  return truncate(text, limit);
};

sidePanelProto.escapeHtmlBasic = (text: string) => escapeHtmlBasic(text);

sidePanelProto.escapeHtml = (text: string) => escapeHtml(text);

sidePanelProto.escapeAttribute = (value: string) => escapeAttribute(value);

sidePanelProto.createStepContainer = function createStepContainer(stepIndex: number, title: string) {
  const el = document.createElement('div');
  el.className = 'step-block current';
  el.dataset.stepIndex = String(stepIndex);

  el.innerHTML = `
    <button class="step-header" type="button" aria-expanded="true">
      <span class="step-title">${this.escapeHtmlBasic(`Step ${stepIndex + 1}: ${title}`)}</span>
      <span class="step-meta"></span>
      <span class="step-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="step-content">
      <div class="step-tools"></div>
      <div class="step-body"></div>
    </div>
  `;

  const header = el.querySelector('.step-header') as HTMLButtonElement | null;
  header?.addEventListener('click', () => {
    el.classList.toggle('collapsed');
    const expanded = !el.classList.contains('collapsed');
    header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });

  return {
    el,
    toolsEl: (el.querySelector('.step-tools') as HTMLElement) || el,
    bodyEl: (el.querySelector('.step-body') as HTMLElement) || el,
  };
};

sidePanelProto.ensureStepContainer = function ensureStepContainer(stepIndex: number, stepTitle?: string) {
  if (!this.streamingState?.eventsEl) return null;

  const normalizedIndex = Number.isFinite(stepIndex) ? stepIndex : 0;
  const existing = this.stepTimeline.steps.get(normalizedIndex);
  if (existing) {
    this.setActiveStep(normalizedIndex);
    if (stepTitle) {
      const titleEl = existing.el.querySelector('.step-title');
      if (titleEl) titleEl.textContent = `Step ${normalizedIndex + 1}: ${stepTitle}`;
    }
    return existing;
  }

  const title = stepTitle || `Step ${normalizedIndex + 1}`;
  const created = this.createStepContainer(normalizedIndex, title);

  this.streamingState.eventsEl.appendChild(created.el);
  this.stepTimeline.steps.set(normalizedIndex, created);
  this.setActiveStep(normalizedIndex);
  return created;
};

sidePanelProto.setActiveStep = function setActiveStep(stepIndex: number) {
  this.stepTimeline.activeStepIndex = stepIndex;
  const target = this.stepTimeline.steps.get(stepIndex) || null;
  this.stepTimeline.activeStepBody = target?.bodyEl || null;

  this.stepTimeline.steps.forEach((step, idx) => {
    step.el.classList.toggle('current', idx === stepIndex);
  });
};
