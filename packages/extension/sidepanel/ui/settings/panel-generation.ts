import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

type NumberBinding = { el: string; key: string; fallback: number; parse: 'int' | 'float' };
type BoolBinding = { el: string; key: string; defaultTrue: boolean };

const NUMBER_BINDINGS: NumberBinding[] = [
  { el: 'genTemperature', key: 'temperature', fallback: 0.7, parse: 'float' },
  { el: 'genMaxTokens', key: 'maxTokens', fallback: 4096, parse: 'int' },
  { el: 'genContextLimit', key: 'contextLimit', fallback: 200000, parse: 'int' },
  { el: 'genTimeout', key: 'timeout', fallback: 30000, parse: 'int' },
];

const BOOL_BINDINGS: BoolBinding[] = [
  { el: 'genEnableScreenshots', key: 'enableScreenshots', defaultTrue: false },
  { el: 'genSendScreenshots', key: 'sendScreenshotsAsImages', defaultTrue: false },
  { el: 'genStreamResponses', key: 'streamResponses', defaultTrue: true },
  { el: 'genShowThinking', key: 'showThinking', defaultTrue: true },
  { el: 'genAutoScroll', key: 'autoScroll', defaultTrue: true },
  { el: 'genConfirmActions', key: 'confirmActions', defaultTrue: true },
  { el: 'genSaveHistory', key: 'saveHistory', defaultTrue: true },
  { el: 'genNotifyOnTurnComplete', key: 'notifyOnTurnComplete', defaultTrue: false },
];

const parseNum = (raw: string, fallback: number, mode: 'int' | 'float') => {
  const v = mode === 'float' ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
  return Number.isFinite(v) ? v : fallback;
};

sidePanelProto.populateGenerationTab = function populateGenerationTab() {
  const config = this.configs?.[this.currentConfig] || {};

  for (const { el, key, fallback, parse } of NUMBER_BINDINGS) {
    const ctrl = this.elements[el];
    if (!ctrl) continue;
    const raw = config[key];
    const val = typeof raw === 'number' ? raw : parseNum(String(raw ?? ''), fallback, parse);
    ctrl.value = String(val);
  }

  // Temperature display
  if (this.elements.genTemperatureValue) {
    this.elements.genTemperatureValue.textContent = Number(this.elements.genTemperature?.value || 0.7).toFixed(2);
  }

  for (const { el, key, defaultTrue } of BOOL_BINDINGS) {
    const ctrl = this.elements[el] as HTMLInputElement | null;
    if (!ctrl) continue;
    ctrl.checked = defaultTrue ? config[key] !== false : config[key] === true;
  }

  // Screenshot quality
  if (this.elements.genScreenshotQuality) {
    this.elements.genScreenshotQuality.value = config.screenshotQuality || 'high';
  }
};

sidePanelProto.updateActiveConfigFromGenerationTab = function updateActiveConfigFromGenerationTab() {
  const config = this.configs?.[this.currentConfig];
  if (!config) return;

  for (const { el, key, fallback, parse } of NUMBER_BINDINGS) {
    const ctrl = this.elements[el];
    if (!ctrl) continue;
    config[key] = parseNum(ctrl.value, fallback, parse);
  }

  for (const { el, key } of BOOL_BINDINGS) {
    const ctrl = this.elements[el] as HTMLInputElement | null;
    if (!ctrl) continue;
    config[key] = ctrl.checked;
  }

  if (this.elements.genScreenshotQuality) {
    config.screenshotQuality = this.elements.genScreenshotQuality.value || 'high';
  }

  void this.persistAllSettings?.({ silent: true });
};
