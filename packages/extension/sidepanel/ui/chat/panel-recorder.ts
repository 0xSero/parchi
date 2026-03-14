import type { RecordedContext, RecordingEvent, RecordingScreenshot } from '@parchi/shared';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import { buildSkillFromEvents } from './recording-to-skill.js';

const formatTime = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
};

const syncRecordButtonState = (button: HTMLButtonElement | null, recording: boolean) => {
  if (!button) return;
  button.classList.toggle('recording', recording);
  button.setAttribute('aria-pressed', recording ? 'true' : 'false');
  button.title = recording ? 'Stop recording' : 'Record context';
  if (recording) {
    button.setAttribute('data-tooltip', 'Stop recording');
  } else {
    button.setAttribute('data-tooltip', 'Record context');
  }
};

// ──────────────────────────────────────────────────────────────────────
// Recording start / stop / timer (unchanged)
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.startRecording = async function startRecording() {
  if (this.recordingState.status !== 'idle') return;
  this.recordingState.status = 'recording';
  this.recordingState.elapsedMs = 0;

  syncRecordButtonState(this.elements.recordBtn, true);
  this.showRecordingTimer();
  this.updateStatus('Recording started. Click again to stop.', 'active');

  try {
    // Resolve the active tab from the sidepanel context so the background
    // service worker doesn't have to guess.
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = activeTab?.id;
    if (!tabId) throw new Error('No active tab found');

    const response = await chrome.runtime.sendMessage({ type: 'recording_start', tabId });
    if (response && response.success === false) {
      throw new Error(response.error || 'Recording failed');
    }
  } catch (err: unknown) {
    console.error('[Parchi] Recording start failed:', err);
    this.cleanupRecordingUI();
    const message = err instanceof Error ? err.message : String(err ?? '');
    this.updateStatus('Recording failed: ' + message, 'error');
    return;
  }

  this.recordingState.timerId = window.setInterval(() => {
    this.recordingState.elapsedMs += 1000;
    this.renderRecordingTimer(this.recordingState.elapsedMs);
    if (this.recordingState.elapsedMs >= 60000) {
      this.stopRecording();
    }
  }, 1000);
};

sidePanelProto.stopRecording = async function stopRecording() {
  if (this.recordingState.status !== 'recording') return;
  this.recordingState.status = 'selecting';

  if (this.recordingState.timerId) {
    clearInterval(this.recordingState.timerId);
    this.recordingState.timerId = null;
  }

  syncRecordButtonState(this.elements.recordBtn, false);
  this.hideRecordingTimer();
  this.updateStatus('Recording stopped. Preparing review...', 'active');

  try {
    await chrome.runtime.sendMessage({ type: 'recording_stop' });
  } catch (err: unknown) {
    this.cleanupRecordingUI();
    const message = err instanceof Error ? err.message : String(err ?? '');
    this.updateStatus('Stop failed: ' + message, 'error');
  }
};

sidePanelProto.cleanupRecordingUI = function cleanupRecordingUI() {
  if (this.recordingState.timerId) {
    clearInterval(this.recordingState.timerId);
  }
  this.recordingState = { status: 'idle', elapsedMs: 0, timerId: null };
  this.reviewState = null;
  syncRecordButtonState(this.elements.recordBtn, false);
  this.hideRecordingTimer();
};

sidePanelProto.showRecordingTimer = function showRecordingTimer() {
  const el = this.elements.recordingTimer;
  if (el) {
    el.classList.remove('hidden');
    this.renderRecordingTimer(0);
  }
};

sidePanelProto.hideRecordingTimer = function hideRecordingTimer() {
  const el = this.elements.recordingTimer;
  if (el) el.classList.add('hidden');
};

sidePanelProto.renderRecordingTimer = function renderRecordingTimer(elapsedMs: number) {
  const timeEl = this.elements.recordingTimer?.querySelector('.recording-time');
  if (timeEl) {
    timeEl.textContent = `${formatTime(elapsedMs)} / 1:00`;
  }
};

// ──────────────────────────────────────────────────────────────────────
// Tabbed Review Modal
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.showRecordingReview = function showRecordingReview(
  screenshots: RecordingScreenshot[],
  events: RecordingEvent[],
) {
  const modal = this.elements.imagePickerModal;
  const grid = this.elements.imagePickerGrid;
  const timelineContainer = this.elements.actionTimelineContainer;
  if (!modal) return;

  // Initialise review state
  const excludedIndices = new Set<number>();
  // Exclude dom_mutation events by default
  events.forEach((ev: RecordingEvent, i: number) => {
    if (ev.type === 'dom_mutation') excludedIndices.add(i);
  });

  this.reviewState = {
    events,
    screenshots,
    excludedEventIndices: excludedIndices,
    selectedScreenshotIds: new Set<string>(),
    activeTab: 'actions' as const,
  };

  // Update header count
  const actionCount = events.filter((e: RecordingEvent) => e.type !== 'dom_mutation').length;
  const countEl = this.elements.imagePickerCount;
  if (countEl) countEl.textContent = `${actionCount} action${actionCount !== 1 ? 's' : ''}`;

  // Render action timeline
  if (timelineContainer) {
    timelineContainer.innerHTML = '';
    const startTs = events[0]?.timestamp || 0;
    const timeline = this.renderActionTimeline(events, startTs);
    timelineContainer.appendChild(timeline);
  }

  // Render screenshot grid
  if (grid) {
    grid.innerHTML = '';
    for (const ss of screenshots) {
      const cell = document.createElement('div');
      cell.className = 'image-picker-cell';
      cell.dataset.id = ss.id;

      const img = document.createElement('img');
      img.src = ss.dataUrl;
      img.alt = `Screenshot ${ss.index + 1}`;

      const timestamp = document.createElement('span');
      timestamp.className = 'image-picker-timestamp';
      timestamp.textContent = formatTime(ss.timestamp - (screenshots[0]?.timestamp || ss.timestamp));

      const badge = document.createElement('span');
      badge.className = 'image-picker-badge hidden';

      cell.appendChild(img);
      cell.appendChild(timestamp);
      cell.appendChild(badge);

      cell.addEventListener('click', () => {
        if (!this.reviewState) return;
        const selected = this.reviewState.selectedScreenshotIds;
        if (selected.has(ss.id)) {
          selected.delete(ss.id);
          cell.classList.remove('selected');
          badge.classList.add('hidden');
        } else if (selected.size < 5) {
          selected.add(ss.id);
          cell.classList.add('selected');
          badge.classList.remove('hidden');
        }
        // Renumber badges
        let n = 1;
        for (const s of screenshots) {
          if (selected.has(s.id)) {
            const c = grid.querySelector(`[data-id="${s.id}"] .image-picker-badge`) as HTMLElement | null;
            if (c) {
              c.textContent = String(n);
              c.classList.remove('hidden');
            }
            n++;
          }
        }
        this.updateScreenshotTabLabel(selected.size);
      });

      grid.appendChild(cell);
    }
  }

  // Set initial tab state
  this.switchReviewTab('actions');
  modal.classList.remove('hidden');

  // Wire buttons (clone-and-replace to remove old listeners)
  const cancel = this.elements.imagePickerCancel;
  const attachOnly = this.elements.reviewAttachOnlyBtn;
  const saveSkill = this.elements.reviewSaveSkillBtn;
  const backdrop = modal.querySelector('.image-picker-backdrop');
  const tabActions = this.elements.reviewTabActions;
  const tabScreenshots = this.elements.reviewTabScreenshots;

  const close = () => {
    modal.classList.add('hidden');
    this.cleanupRecordingUI();
    chrome.runtime.sendMessage({ type: 'recording_discard' }).catch(() => {});
  };

  const doAttachOnly = () => {
    modal.classList.add('hidden');
    if (!this.reviewState) {
      close();
      return;
    }
    const ids = Array.from(this.reviewState.selectedScreenshotIds) as string[];
    if (ids.length === 0) {
      // Still send with empty selection — background creates context from events
      chrome.runtime.sendMessage({ type: 'recording_select_images', selectedIds: [] }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({ type: 'recording_select_images', selectedIds: ids }).catch(() => {});
    }
  };

  const doSaveSkill = () => {
    this.saveRecordingAsSkill();
  };

  // Replace listeners helper
  const replaceBtn = (el: HTMLElement | null, handler: () => void): void => {
    if (!el) return;
    const fresh = el.cloneNode(true) as HTMLElement;
    el.replaceWith(fresh);
    // Update element ref by id
    const id = fresh.id;
    if (id) this.elements[id] = fresh;
    fresh.addEventListener('click', handler);
  };

  replaceBtn(cancel, close);
  replaceBtn(attachOnly, doAttachOnly);
  replaceBtn(saveSkill, doSaveSkill);

  if (tabActions) {
    const newTab = tabActions.cloneNode(true) as HTMLElement;
    tabActions.replaceWith(newTab);
    this.elements.reviewTabActions = newTab;
    newTab.addEventListener('click', () => this.switchReviewTab('actions'));
  }
  if (tabScreenshots) {
    const newTab = tabScreenshots.cloneNode(true) as HTMLElement;
    tabScreenshots.replaceWith(newTab);
    this.elements.reviewTabScreenshots = newTab;
    newTab.addEventListener('click', () => this.switchReviewTab('screenshots'));
  }

  if (backdrop) {
    const newBackdrop = backdrop.cloneNode(true) as HTMLElement;
    backdrop.replaceWith(newBackdrop);
    newBackdrop.addEventListener('click', close, { once: true });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Tab switching
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.switchReviewTab = function switchReviewTab(tab: 'actions' | 'screenshots') {
  if (this.reviewState) this.reviewState.activeTab = tab;

  const actionsPanel = this.elements.reviewActionsPanel;
  const screenshotsPanel = this.elements.reviewScreenshotsPanel;
  const tabActions = this.elements.reviewTabActions;
  const tabScreenshots = this.elements.reviewTabScreenshots;

  if (tab === 'actions') {
    actionsPanel?.classList.remove('hidden');
    screenshotsPanel?.classList.add('hidden');
    tabActions?.classList.add('active');
    tabScreenshots?.classList.remove('active');
  } else {
    actionsPanel?.classList.add('hidden');
    screenshotsPanel?.classList.remove('hidden');
    tabActions?.classList.remove('active');
    tabScreenshots?.classList.add('active');
  }
};

sidePanelProto.updateScreenshotTabLabel = function updateScreenshotTabLabel(count: number) {
  const tab = this.elements.reviewTabScreenshots;
  if (tab) tab.textContent = count > 0 ? `Screenshots (${count})` : 'Screenshots';
};

// ──────────────────────────────────────────────────────────────────────
// Save recording as ComposedSkill
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.saveRecordingAsSkill = async function saveRecordingAsSkill() {
  if (!this.reviewState) return;

  const { events, excludedEventIndices, selectedScreenshotIds } = this.reviewState;

  // Filter to only included events
  const includedEvents = events.filter((_: RecordingEvent, i: number) => !excludedEventIndices.has(i));

  if (includedEvents.length === 0) {
    this.updateStatus('No actions to save', 'warning');
    return;
  }

  try {
    // Build the skill
    const skill = buildSkillFromEvents(includedEvents, this.sessionId);

    // Save to skills storage
    const data = await chrome.storage.local.get('skills');
    const skills = Array.isArray(data.skills) ? data.skills : [];
    skills.push(skill);
    await chrome.storage.local.set({ skills });

    // Also save as a workflow for the /slash command menu
    const workflow = {
      id: crypto.randomUUID(),
      name: skill.name,
      prompt:
        skill.description +
        '\n\nSteps:\n' +
        skill.steps
          .map((s: unknown, i: number) => {
            const step = s as { tool?: unknown; args?: unknown };
            return `${i + 1}. ${String(step.tool)}(${JSON.stringify(step.args)})`;
          })
          .join('\n'),
      createdAt: Date.now(),
    };
    this.workflows.push(workflow);
    await chrome.storage.local.set({ workflows: this.workflows });

    // Close modal and attach context (existing behavior)
    const modal = this.elements.imagePickerModal;
    if (modal) modal.classList.add('hidden');

    const ids = Array.from(selectedScreenshotIds) as string[];
    chrome.runtime.sendMessage({ type: 'recording_select_images', selectedIds: ids }).catch(() => {});

    this.updateStatus(`Skill "${skill.name}" saved`, 'success');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? '');
    this.updateStatus('Failed to save skill: ' + message, 'error');
  }
};

// ──────────────────────────────────────────────────────────────────────
// Context badge + recording message handler
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.attachRecordedContext = function attachRecordedContext(context: RecordedContext) {
  this.pendingRecordedContext = context;
  this.showRecordedContextBadge();
};

sidePanelProto.removeRecordedContext = function removeRecordedContext() {
  this.pendingRecordedContext = null;
  this.hideRecordedContextBadge();
};

sidePanelProto.showRecordedContextBadge = function showRecordedContextBadge() {
  const badge = this.elements.recordedContextBadge;
  if (badge) badge.classList.remove('hidden');
};

sidePanelProto.hideRecordedContextBadge = function hideRecordedContextBadge() {
  const badge = this.elements.recordedContextBadge;
  if (badge) badge.classList.add('hidden');
};

sidePanelProto.handleRecordingMessage = function handleRecordingMessage(message: unknown) {
  const msg = message as any;
  switch (msg.type) {
    case 'recording_tick': {
      if (this.recordingState.status === 'recording') {
        this.recordingState.elapsedMs = Number(msg.elapsedMs || 0);
      }
      break;
    }
    case 'recording_complete': {
      this.showRecordingReview(msg.screenshots, msg.events || []);
      break;
    }
    case 'recording_context_ready': {
      this.cleanupRecordingUI();
      this.attachRecordedContext(msg.context);
      this.updateStatus('Recording attached', 'success');
      break;
    }
    case 'recording_error': {
      this.cleanupRecordingUI();
      this.updateStatus('Recording error: ' + String(msg.message || ''), 'error');
      break;
    }
  }
};
