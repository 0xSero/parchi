import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const EMPTY_TIPS = [
  'Add open tabs as context with the tab selector button.',
  'Type / in the composer to use skills.',
  'Click the record button to teach the model a workflow.',
  'Sessions older than 7 days are auto-pruned to keep things fast.',
  'Attach files like .md, .csv, or .json for richer answers.',
  'Switch profiles to try different models or prompts.',
  'Export your conversation as markdown from the toolbar.',
  'Use the history drawer to revisit past sessions.',
];

let _tipTimer: ReturnType<typeof setInterval> | null = null;
let _tipIndex = Math.floor(Math.random() * EMPTY_TIPS.length);
let _startersWired = false;

sidePanelProto.updateChatEmptyState = function updateChatEmptyState() {
  const emptyState = this.elements.chatEmptyState;
  if (!emptyState) return;
  const hasMessages =
    (this.displayHistory && this.displayHistory.length > 0) ||
    (this.elements.chatMessages && this.elements.chatMessages.children.length > 0);
  emptyState.classList.toggle('hidden', hasMessages);

  // Wire up prompt starters once via event delegation
  if (!_startersWired) {
    _startersWired = true;
    emptyState.addEventListener('click', (e: Event) => {
      const starter = (e.target as HTMLElement).closest('.chat-empty-starter') as HTMLElement | null;
      if (!starter) return;
      const prompt = starter.dataset.prompt;
      if (!prompt || !this.elements.userInput) return;
      this.elements.userInput.value = prompt;
      this.elements.userInput.focus();
      this.sendMessage();
    });
  }

  const tipEl = emptyState.querySelector('#emptyTip') as HTMLElement | null;
  if (!tipEl) return;

  if (hasMessages) {
    if (_tipTimer) {
      clearInterval(_tipTimer);
      _tipTimer = null;
    }
    return;
  }

  // Show first tip immediately
  if (!tipEl.textContent) {
    tipEl.textContent = EMPTY_TIPS[_tipIndex];
    tipEl.classList.add('visible');
  }

  if (!_tipTimer) {
    _tipTimer = setInterval(() => {
      tipEl.classList.remove('visible');
      setTimeout(() => {
        _tipIndex = (_tipIndex + 1) % EMPTY_TIPS.length;
        tipEl.textContent = EMPTY_TIPS[_tipIndex];
        tipEl.classList.add('visible');
      }, 300);
    }, 6000);
  }
};
