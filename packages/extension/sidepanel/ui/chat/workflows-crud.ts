import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

type Workflow = { id: string; name: string; prompt: string; createdAt: number };

sidePanelProto.loadWorkflows = async function loadWorkflows(): Promise<void> {
  try {
    const data = await chrome.storage.local.get('workflows');
    this.workflows = Array.isArray(data.workflows) ? data.workflows : [];
  } catch {
    this.workflows = [];
  }
};

sidePanelProto.saveWorkflow = async function saveWorkflow(
  name: string,
  prompt: string,
  positiveExamples?: Array<{ tool: string; args: any; result: string }>,
  negativeExamples?: Array<{ tool: string; args: any; error: string; count: number }>,
): Promise<void> {
  const workflow: Workflow = {
    id: crypto.randomUUID(),
    name: name.trim(),
    prompt,
    createdAt: Date.now(),
  };
  this.workflows.push(workflow);
  await chrome.storage.local.set({ workflows: this.workflows });

  // Also save as a composable skill
  const skills = (await chrome.storage.local.get('skills')).skills || [];
  const currentUrl = window.location.href || '';
  const hostname = (() => {
    try {
      return new URL(currentUrl).hostname;
    } catch {
      return '';
    }
  })();
  const posExamples = Array.isArray(positiveExamples) ? positiveExamples : [];
  const negExamples = Array.isArray(negativeExamples) ? negativeExamples : [];
  skills.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    description: prompt.slice(0, 200),
    sitePattern: hostname ? `${hostname}*` : '',
    steps: posExamples.slice(0, 20).map((ex: any) => ({ tool: ex.tool, args: ex.args })),
    prompt,
    positiveExamples: posExamples.slice(0, 10),
    negativeExamples: negExamples.slice(0, 10),
    createdAt: Date.now(),
    sourceSessionId: this.sessionId || '',
    successCount: 0,
    failureCount: 0,
  });
  await chrome.storage.local.set({ skills });
};

sidePanelProto.deleteWorkflow = async function deleteWorkflow(id: string): Promise<void> {
  this.workflows = this.workflows.filter((w: Workflow) => w.id !== id);
  await chrome.storage.local.set({ workflows: this.workflows });
};
