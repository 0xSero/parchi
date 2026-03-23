import { dedupeThinking } from '../../../ai/messages/utils.js';
import { clearToolCallViews } from '../core/panel-session-memory.js';
import { sidePanelProto } from './panel-tools-shared.js';

sidePanelProto.refreshTimelineHud = function refreshTimelineHud() {
  // No-op: run-hud removed
};

sidePanelProto.updateActivityState = function updateActivityState() {
  const toolbarLabels: string[] = [];

  if (this.runStartedAt) {
    const elapsed = Math.max(0, Date.now() - this.runStartedAt);
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    toolbarLabels.push(`Run ${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`);
  }

  if (this.contextUsage && this.contextUsage.maxContextTokens) {
    const used = Math.max(0, this.contextUsage.approxTokens || 0);
    const max = Math.max(1, this.contextUsage.maxContextTokens || 0);
    const usedLabel = used >= 10000 ? `${(used / 1000).toFixed(1)}k` : `${used}`;
    const maxLabel = max >= 10000 ? `${(max / 1000).toFixed(0)}k` : `${max}`;
    toolbarLabels.push(`${usedLabel} / ${maxLabel}`);
  }

  if (this.contextCompactionState?.inProgress) {
    toolbarLabels.push('Compacting');
  } else if (this.contextCompactionState?.lastResult === 'success') {
    const compactedAt = Number(this.contextCompactionState.lastCompactedAt || 0);
    if (compactedAt > 0 && Date.now() - compactedAt < 15000) {
      toolbarLabels.push('Compacted');
    }
  }

  const usageLabel = this.buildUsageLabel?.(this.lastUsage);
  if (usageLabel) toolbarLabels.push(usageLabel);
  if (this.elements.statusMeta) this.elements.statusMeta.textContent = toolbarLabels.join(' · ');

  const bubbleLabels: string[] = [];
  if (this.pendingToolCount > 0) {
    bubbleLabels.push(`${this.pendingToolCount} action${this.pendingToolCount > 1 ? 's' : ''} running`);
  }
  if (this.isStreaming) bubbleLabels.push('Streaming');

  const bubbleMeta = document.getElementById('bubbleMeta');
  if (bubbleMeta) bubbleMeta.textContent = bubbleLabels.join(' · ');

  this.updateMascotEyeState();
  this.updateActivityToggle();
};

sidePanelProto.updateActivityToggle = function updateActivityToggle() {
  // Activity panel removed — no-op
};

sidePanelProto.toggleActivityPanel = function toggleActivityPanel(_force?: boolean) {
  // Activity panel removed — no-op
};

sidePanelProto.initMascotBubble = function initMascotBubble() {
  const mascot = document.getElementById('mascotCorner');
  if (!mascot) return;

  this._lastTypingAt = 0;
  this._typingCheckTimerId = null;
  this._mascotBubbleOpen = false;

  mascot.addEventListener('click', () => {
    this.toggleMascotBubble();
  });

  const userInput = this.elements.userInput;
  if (userInput) {
    userInput.addEventListener('input', () => {
      this._lastTypingAt = Date.now();
      this.updateMascotEyeState();
      if (!this._typingCheckTimerId) {
        this._typingCheckTimerId = window.setInterval(() => {
          const elapsed = Date.now() - this._lastTypingAt;
          if (elapsed >= 5000) {
            if (this._typingCheckTimerId) {
              window.clearInterval(this._typingCheckTimerId);
              this._typingCheckTimerId = null;
            }
            this.updateMascotEyeState();
          }
        }, 1000);
      }
    });
  }
};

sidePanelProto.toggleMascotBubble = function toggleMascotBubble() {
  const bubble = document.getElementById('mascotBubble');
  if (!bubble) return;
  this._mascotBubbleOpen = !this._mascotBubbleOpen;
  if (this._mascotBubbleOpen) {
    bubble.classList.remove('hidden');
    this.updateActivityState();
  } else {
    bubble.classList.add('hidden');
  }
};

sidePanelProto.updateMascotBubbleContent = function updateMascotBubbleContent(verb: string, elapsed: string) {
  const bubbleVerb = document.getElementById('bubbleVerb');
  if (bubbleVerb) bubbleVerb.textContent = `${verb} ${elapsed}`;
};

sidePanelProto.updateMascotEyeState = function updateMascotEyeState() {
  const mascot = document.getElementById('mascotCorner');
  if (!mascot) return;
  const isRunning = !!(this.runStartedAt || this.isStreaming || this.pendingToolCount > 0);
  const isTyping = this._lastTypingAt && Date.now() - this._lastTypingAt < 5000;

  mascot.classList.remove('sleeping', 'working', 'looking-up', 'thinking', 'awake');
  if (isRunning) {
    mascot.classList.add('working');
  } else if (isTyping) {
    mascot.classList.add('looking-up');
  } else {
    mascot.classList.add('awake');
  }
};

sidePanelProto.updateThinkingPanel = function updateThinkingPanel(thinking: string | null, isStreaming = false) {
  if (thinking) {
    this.latestThinking = dedupeThinking(thinking.trim());
  } else if (!isStreaming) {
    this.latestThinking = null;
  }

  if (this.streamingState?.eventsEl && this.latestThinking) {
    let thinkingBlock = this.streamingState.eventsEl.querySelector('.inline-thinking-block') as HTMLElement | null;
    if (!thinkingBlock) {
      thinkingBlock = document.createElement('div');
      thinkingBlock.className = 'inline-thinking-block';
      thinkingBlock.innerHTML = `
        <div class="thinking-block-inner">
          <div class="thinking-header-inline">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <span>Thinking</span>
          </div>
          <div class="thinking-content-inline"></div>
        </div>
      `;
      // Insert before the first text event for interleaved display
      const firstTextEvent = this.streamingState.eventsEl.querySelector(':scope > .stream-event-text');
      if (firstTextEvent) {
        this.streamingState.eventsEl.insertBefore(thinkingBlock, firstTextEvent);
      } else {
        this.streamingState.eventsEl.appendChild(thinkingBlock);
      }
    }

    const contentEl = thinkingBlock.querySelector('.thinking-content-inline') as HTMLElement | null;
    if (contentEl) contentEl.textContent = this.latestThinking;
  }
};

sidePanelProto.resetActivityPanel = function resetActivityPanel() {
  if (this.elements.chatMessages) {
    const trees = this.elements.chatMessages.querySelectorAll('.tool-card, .step-block');
    trees.forEach((tree) => tree.remove());
  }
  this.latestThinking = null;
  this.activeToolName = null;
  clearToolCallViews(this.toolCallViews);
  this.stepTimeline.steps.clear();
  this.stepTimeline.activeStepIndex = null;
  this.stepTimeline.activeStepBody = null;
};
