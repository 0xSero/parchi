import { getSubagentColor } from './subagent-colors.js';

type BadgeState = {
  bar: HTMLDivElement | null;
  tag: HTMLDivElement | null;
  tagLabel: HTMLSpanElement | null;
  styleEl: HTMLStyleElement | null;
};

export class SubagentBadgeController {
  badge: BadgeState;

  constructor() {
    this.badge = { bar: null, tag: null, tagLabel: null, styleEl: null };
  }

  ensureBadge() {
    if (this.badge.bar) return;
    const styleEl = document.createElement('style');
    styleEl.textContent = [
      '#parchi-sa-bar{position:fixed;top:0;left:0;right:0;height:3px;z-index:2147483647;pointer-events:none;',
      'background:var(--sa-c);box-shadow:0 0 12px var(--sa-c),0 1px 4px rgba(0,0,0,.3);',
      'transition:opacity 180ms ease;opacity:1}',
      '#parchi-sa-bar[data-status="completed"]{background:#56cc9d;box-shadow:0 0 12px #56cc9d}',
      '#parchi-sa-bar[data-status="error"]{background:#f25c54;box-shadow:0 0 12px #f25c54}',
      '#parchi-sa-tag{position:fixed;top:6px;left:8px;z-index:2147483647;pointer-events:none;',
      'display:flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:0 0 8px 8px;',
      'background:rgba(8,12,18,.82);backdrop-filter:blur(8px);border:1px solid rgb(var(--sa-rgb)/.25);',
      'border-top:none;font:600 10px/1.3 "Space Grotesk","Inter",system-ui,sans-serif;',
      'color:rgb(244 241 232/.82);opacity:0;transition:opacity 240ms ease;',
      'letter-spacing:.04em;text-transform:uppercase}',
      '#parchi-sa-tag:hover{opacity:1!important}',
      '#parchi-sa-bar:hover~#parchi-sa-tag{opacity:1!important}',
      '.parchi-sa-dot{width:6px;height:6px;border-radius:50%;background:var(--sa-c);',
      'box-shadow:0 0 8px var(--sa-c);flex-shrink:0}',
      '@keyframes parchiBarIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
      '#parchi-sa-bar{transform-origin:left;animation:parchiBarIn 300ms ease-out}',
    ].join('\n');
    document.head.appendChild(styleEl);

    const bar = document.createElement('div');
    bar.id = 'parchi-sa-bar';
    const tag = document.createElement('div');
    tag.id = 'parchi-sa-tag';
    const dot = document.createElement('span');
    dot.className = 'parchi-sa-dot';
    const tagLabel = document.createElement('span');
    tag.append(dot, tagLabel);
    document.documentElement.append(bar, tag);
    this.badge = { bar, tag, tagLabel, styleEl };
  }

  showBadge(payload: Record<string, unknown>) {
    this.ensureBadge();
    const { bar, tag, tagLabel } = this.badge;
    if (!bar || !tag || !tagLabel) return;
    const color = getSubagentColor(Number(payload.colorIndex || 0));
    const status = String(payload.status || 'running');
    bar.style.setProperty('--sa-c', color.hex);
    bar.style.setProperty('--sa-rgb', color.rgb);
    tag.style.setProperty('--sa-c', color.hex);
    tag.style.setProperty('--sa-rgb', color.rgb);
    bar.dataset.status = status;
    tagLabel.textContent = String(payload.name || 'Agent');
    bar.style.opacity = '1';
    tag.style.opacity = '0.6';
  }

  clearBadge() {
    if (this.badge.bar) this.badge.bar.style.opacity = '0';
    if (this.badge.tag) this.badge.tag.style.opacity = '0';
  }

  destroyBadge() {
    const { bar, tag, styleEl } = this.badge;
    if (bar && bar.isConnected) bar.remove();
    if (tag && tag.isConnected) tag.remove();
    if (styleEl && styleEl.isConnected) styleEl.remove();
    this.badge = { bar: null, tag: null, tagLabel: null, styleEl: null };
  }
}
