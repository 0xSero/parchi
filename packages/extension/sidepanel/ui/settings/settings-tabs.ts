import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.switchSettingsTab = function switchSettingsTab(
  tabName: 'providers' | 'model' | 'generation' | 'display' | 'advanced' | string = 'providers',
) {
  const tabMap: Record<string, string> = {
    connect: 'providers',
    setup: 'providers',
    oauth: 'providers',
    profiles: 'model',
    look: 'display',
    design: 'display',
    theme: 'display',
    agents: 'advanced',
    system: 'advanced',
    usage: 'advanced',
  };
  const resolvedTab = (tabMap[tabName] || tabName) as 'providers' | 'model' | 'generation' | 'display' | 'advanced';
  this.currentSettingsTab = resolvedTab;

  const tabs = ['providers', 'model', 'generation', 'display', 'advanced'] as const;
  const tabElements: Record<string, HTMLElement | null> = {
    providers: this.elements.settingsTabProviders || document.getElementById('settingsTabProviders'),
    model: this.elements.settingsTabModel || document.getElementById('settingsTabModel'),
    generation: this.elements.settingsTabGeneration || document.getElementById('settingsTabGeneration'),
    display: document.getElementById('settingsTabDisplay'),
    advanced: this.elements.settingsTabAdvanced || document.getElementById('settingsTabAdvanced'),
  };
  const btnElements: Record<string, HTMLElement | null> = {
    providers: this.elements.settingsTabProvidersBtn || document.getElementById('settingsTabProvidersBtn'),
    model: this.elements.settingsTabModelBtn || document.getElementById('settingsTabModelBtn'),
    generation: this.elements.settingsTabGenerationBtn || document.getElementById('settingsTabGenerationBtn'),
    display: document.getElementById('settingsTabDisplayBtn'),
    advanced: this.elements.settingsTabAdvancedBtn || document.getElementById('settingsTabAdvancedBtn'),
  };

  for (const tab of tabs) {
    const isActive = tab === resolvedTab;
    tabElements[tab]?.classList.toggle('hidden', !isActive);
    btnElements[tab]?.classList.toggle('active', isActive);
    const pane = tabElements[tab]?.querySelector('.settings-tab-pane') as HTMLElement | null;
    pane?.classList.toggle('active', isActive);
    btnElements[tab]?.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }

  if (resolvedTab === 'providers') {
    this.renderOAuthProviderGrid?.();
    this.renderPaidModeProviderGrid?.();
    this.renderApiProviderGrid?.();
  }
  if (resolvedTab === 'model') {
    this.renderModelSelectorGrid?.();
  }
  if (resolvedTab === 'generation') {
    this.populateGenerationTab?.();
  }
  if (resolvedTab === 'display') {
    this.renderThemeGrid?.({ icons: true });
  }
  if (resolvedTab === 'advanced') {
    this.renderTeamProfileList?.();
  }
};

sidePanelProto.cancelSettings = async function cancelSettings() {
  await this.loadSettings();
  this.openChatView?.();
};
