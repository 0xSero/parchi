import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.showWorkflowSaveInput = function showWorkflowSaveInput(): void {
  const saveRow = document.getElementById('workflowSaveRow');
  if (!saveRow) return;

  const hasSession = this.displayHistory?.length > 0 || this.historyTurnMap?.size > 0;

  saveRow.innerHTML = `
    <div class="workflow-save-form">
      <input type="text" class="workflow-save-input" id="workflowNameInput"
        placeholder="Name (e.g. summarize)" autocomplete="off" spellcheck="false" />
      <textarea class="workflow-save-prompt" id="workflowPromptInput" rows="3"
        placeholder="Prompt text to insert…"></textarea>
      <div class="workflow-save-actions">
        ${
          hasSession
            ? `<button class="workflow-generate-btn" id="workflowGenerateBtn" title="Use AI to generate a workflow from this session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          Generate from session
        </button>`
            : ''
        }
        <div class="workflow-save-actions-right">
          <button class="workflow-save-cancel" id="workflowSaveCancel">Cancel</button>
          <button class="workflow-save-confirm" id="workflowSaveConfirm">Save</button>
        </div>
      </div>
    </div>
  `;

  const nameInput = document.getElementById('workflowNameInput') as HTMLInputElement;
  const promptInput = document.getElementById('workflowPromptInput') as HTMLTextAreaElement;
  const resizePromptInput = () => {
    if (!promptInput) return;
    const maxHeight = 500;
    promptInput.style.height = 'auto';
    const nextHeight = Math.min(promptInput.scrollHeight, maxHeight);
    promptInput.style.height = `${nextHeight}px`;
    promptInput.style.overflowY = promptInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const composerValue = this.elements.userInput?.value || '';
  if (composerValue && !composerValue.startsWith('/')) {
    promptInput.value = composerValue;
  }
  resizePromptInput();
  promptInput?.addEventListener('input', resizePromptInput);

  nameInput?.focus();

  const repositionMenu = () => {
    requestAnimationFrame(() => {
      const composerEl = this.elements.composer as HTMLElement | null;
      const menu = document.getElementById('workflowMenu');
      if (composerEl && menu) {
        const rect = composerEl.getBoundingClientRect();
        menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      }
    });
  };

  let _generatedPositiveExamples: Array<{ tool: string; args: any; result: string }> | undefined;
  let _generatedNegativeExamples: Array<{ tool: string; args: any; error: string; count: number }> | undefined;

  const doSave = () => {
    const name = nameInput?.value?.trim();
    const prompt = promptInput?.value?.trim();
    if (!name) {
      nameInput?.focus();
      return;
    }
    if (!prompt) {
      promptInput?.focus();
      return;
    }
    this.saveWorkflow(name, prompt, _generatedPositiveExamples, _generatedNegativeExamples).then(() => {
      this.hideWorkflowMenu();
      const userInput = this.elements.userInput;
      if (userInput && userInput.value.startsWith('/')) {
        userInput.value = '';
        userInput.style.height = 'auto';
      }
      this.updateStatus(`Workflow "/${name}" saved`, 'success');
    });
  };

  // --- Generate from session (AI call) --------------------------------
  const generateBtn = document.getElementById('workflowGenerateBtn');
  generateBtn?.addEventListener('click', async () => {
    // Show loading state
    generateBtn.classList.add('loading');
    generateBtn.setAttribute('disabled', 'true');
    const origText = generateBtn.innerHTML;
    generateBtn.innerHTML = `<svg class="workflow-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>Generating…`;
    this.updateStatus('Generating workflow from session…', 'active');

    try {
      const generated = await this.generateWorkflowFromSession();
      if (generated) {
        if (!nameInput.value.trim()) nameInput.value = generated.name;
        promptInput.value = generated.prompt;
        promptInput.style.height = 'auto';
        promptInput.style.height = `${Math.min(promptInput.scrollHeight, 300)}px`;
        _generatedPositiveExamples = generated.positiveExamples;
        _generatedNegativeExamples = generated.negativeExamples;
        this.updateStatus('Workflow generated', 'success');
      } else {
        this.updateStatus('No session data to generate from', 'warning');
      }
    } catch (err: any) {
      this.updateStatus(`Generation failed: ${err?.message || err}`, 'error');
    } finally {
      generateBtn.innerHTML = origText;
      generateBtn.classList.remove('loading');
      generateBtn.removeAttribute('disabled');
      repositionMenu();
    }
  });

  // --- Key handlers ---------------------------------------------------
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hideWorkflowMenu();
    }
  };
  nameInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    handleKey(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      promptInput?.focus();
    }
  });
  promptInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    handleKey(e);
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      doSave();
    }
  });

  document.getElementById('workflowSaveCancel')?.addEventListener('click', () => this.hideWorkflowMenu());
  document.getElementById('workflowSaveConfirm')?.addEventListener('click', doSave);

  repositionMenu();
};
