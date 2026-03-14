import type { Message } from '../../../ai/messages/schema.js';
import { sidePanelProto } from './panel-export-shared.js';

sidePanelProto.showExportMenu = function showExportMenu(): void {
  const existing = document.getElementById('exportMenu');
  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement('div');
  menu.id = 'exportMenu';
  menu.className = 'export-menu';
  menu.innerHTML = `
    <div class="export-menu-content">
      <div class="export-menu-header">
        <span>Export</span>
        <button class="export-menu-close" title="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="export-menu-body">
        <div class="export-scope-row">
          <button class="export-scope-btn active" data-scope="all">Full session</button>
          <button class="export-scope-btn" data-scope="last">Last response</button>
        </div>
        <label class="export-actions-row">
          <span class="export-toggle-track"><span class="export-toggle-thumb"></span></span>
          <span class="export-actions-label">Include tool actions</span>
        </label>
        <button class="export-go-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>
    </div>
  `;

  const btn = this.elements.exportBtn;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
  }

  let scope: 'all' | 'last' = 'all';
  let includeActions = false;

  const scopeBtns = menu.querySelectorAll('.export-scope-btn');
  scopeBtns.forEach((button) => {
    button.addEventListener('click', () => {
      scopeBtns.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      scope = (button as HTMLElement).dataset.scope as 'all' | 'last';
    });
  });

  const actionsRow = menu.querySelector('.export-actions-row') as HTMLElement;
  actionsRow?.addEventListener('click', () => {
    includeActions = !includeActions;
    actionsRow.classList.toggle('active', includeActions);
  });

  menu.querySelector('.export-go-btn')?.addEventListener('click', () => {
    menu.remove();
    this.runExport(scope, includeActions);
  });
  menu.querySelector('.export-menu-close')?.addEventListener('click', () => menu.remove());
  const closeOnOutside = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node)) {
      menu.remove();
      document.removeEventListener('click', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutside), 0);

  document.body.appendChild(menu);
};

sidePanelProto.runExport = async function runExport(scope: 'all' | 'last', includeActions: boolean): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = scope === 'all' ? 'session' : 'response';
  const filename = `${tag}-${timestamp}.md`;

  if (scope === 'last') {
    this.exportLastResponse(filename, includeActions);
  } else {
    await this.exportFullSession(filename, includeActions);
  }
};

sidePanelProto.exportFullSession = async function exportFullSession(
  filename: string,
  includeActions: boolean,
): Promise<void> {
  let md = '';
  md += '# Session Export\n\n';
  md += `**Exported:** ${new Date().toLocaleString()}\n`;
  md += `**Session:** ${this.sessionId || 'unknown'}\n`;
  if (this.sessionTokenTotals?.totalTokens) {
    md += `**Tokens:** ${this.sessionTokenTotals.totalTokens.toLocaleString()} total `;
    md += `(${this.sessionTokenTotals.inputTokens.toLocaleString()} in / `;
    md += `${this.sessionTokenTotals.outputTokens.toLocaleString()} out)\n`;
  }
  md += '\n---\n\n';

  if (this.displayHistory?.length) {
    for (const entry of this.displayHistory) {
      if (entry.role === 'user') {
        md += '## User\n\n';
        md += `${this.extractTextContent(entry.content)}\n\n`;
      } else if (entry.role === 'assistant') {
        md += '## Assistant\n\n';
        if (entry.thinking) {
          md += `<details>\n<summary>Thinking</summary>\n\n${entry.thinking}\n\n</details>\n\n`;
        }
        md += `${this.extractTextContent(entry.content)}\n\n`;
      } else if (entry.role === 'system' && entry.meta?.kind === 'summary') {
        md += `> **Context Summary:** ${this.extractTextContent(entry.content)}\n\n`;
      }
    }
  }

  if (includeActions) md += await this.buildActionsMarkdown('all');

  if (this.currentPlan?.steps) {
    md += '---\n\n## Plan\n\n';
    for (const step of this.currentPlan.steps) {
      md += `${step.status === 'done' ? '[x]' : '[ ]'} ${step.title}\n`;
    }
    md += '\n';
  }

  if (this.subagents?.size > 0) {
    md += '---\n\n## Subagents\n\n';
    this.subagents.forEach((agent: unknown) => {
      const a = agent as { name?: unknown; status?: unknown; tasks?: unknown };
      md += `- **${String(a.name ?? '')}** (${String(a.status ?? '')})\n`;
      const tasks = Array.isArray(a.tasks) ? a.tasks : [];
      for (const task of tasks) md += `  - ${String(task)}\n`;
      md += '\n';
    });
  }

  md = this.appendSelectedReportImagesMarkdown(md);
  this.downloadMarkdown(md, filename);
};

sidePanelProto.exportLastResponse = async function exportLastResponse(
  filename: string,
  includeActions: boolean,
): Promise<void> {
  let lastAssistant: Message | null = null;
  if (this.displayHistory?.length) {
    for (let i = this.displayHistory.length - 1; i >= 0; i--) {
      if (this.displayHistory[i].role === 'assistant') {
        lastAssistant = this.displayHistory[i];
        break;
      }
    }
  }

  if (!lastAssistant) {
    this.updateStatus('No assistant response to export', 'warning');
    return;
  }

  let md = '';
  if (lastAssistant.thinking) {
    md += `<details>\n<summary>Thinking</summary>\n\n${lastAssistant.thinking}\n\n</details>\n\n`;
  }
  md += `${this.extractTextContent(lastAssistant.content)}\n\n`;
  if (includeActions) md += await this.buildActionsMarkdown('last');

  md = this.appendSelectedReportImagesMarkdown(md);
  this.downloadMarkdown(md, filename);
};
