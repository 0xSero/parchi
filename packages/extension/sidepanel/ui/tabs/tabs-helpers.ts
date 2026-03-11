import { getActiveTab } from '../../../utils/active-tab.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.addActiveTabToSelection = async function addActiveTabToSelection() {
  const activeTab = await getActiveTab();
  if (!activeTab || typeof activeTab.id !== 'number') return;
  this.selectedTabs.set(activeTab.id, this.buildSelectedTab(activeTab));
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};

sidePanelProto.clearSelectedTabs = function clearSelectedTabs() {
  if (this.selectedTabs.size === 0) return;
  this.selectedTabs.clear();
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};

sidePanelProto.buildSelectedTab = function buildSelectedTab(tab: chrome.tabs.Tab) {
  const groupId = typeof tab.groupId === 'number' ? tab.groupId : -1;
  const group = groupId >= 0 ? this.tabGroupInfo.get(groupId) : undefined;
  const hasGroup = groupId >= 0;
  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    windowId: tab.windowId,
    groupId: hasGroup ? groupId : -1,
    groupTitle: hasGroup ? group?.title || `Group ${groupId}` : 'Ungrouped',
    groupColor: hasGroup ? this.mapGroupColor(group?.color) : 'var(--text-tertiary)',
  };
};

sidePanelProto.updateSelectedTabsBar = function updateSelectedTabsBar() {
  // Keep selected tabs context logic, but avoid duplicating this info in the
  // main chat layout. The tab selector button/count remains the primary UI.
  if (this.elements.selectedTabsBar) {
    this.elements.selectedTabsBar.classList.add('hidden');
    this.elements.selectedTabsBar.innerHTML = '';
  }
};

sidePanelProto.updateTabSelectorButton = function updateTabSelectorButton() {
  const count = this.selectedTabs.size;
  if (count > 0) {
    this.elements.tabSelectorBtn.classList.add('has-selection');
    this.elements.tabSelectorBtn.dataset.count = String(count);
  } else {
    this.elements.tabSelectorBtn.classList.remove('has-selection');
    delete this.elements.tabSelectorBtn.dataset.count;
  }
  if (this.elements.tabSelectorSummary) {
    this.elements.tabSelectorSummary.textContent = count > 0 ? `${count} selected` : 'No tabs selected';
  }
};

sidePanelProto.mapGroupColor = function mapGroupColor(colorName: string) {
  const palette: Record<string, string> = {
    grey: '#9aa0a6',
    blue: '#4c8bf5',
    red: '#ea4335',
    yellow: '#fbbc04',
    green: '#34a853',
    pink: '#f06292',
    purple: '#a142f4',
    cyan: '#24c1e0',
    orange: '#f29900',
  };
  return palette[colorName] || 'var(--text-tertiary)';
};

sidePanelProto.formatTabLabel = function formatTabLabel(url?: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

sidePanelProto.getSelectedTabsContext = function getSelectedTabsContext(
  tabs?: Array<any>,
  source: 'selected' | 'active' = 'selected',
) {
  const tabList = tabs ?? Array.from(this.selectedTabs.values());
  if (!tabList.length) return '';

  const label = source === 'active' ? 'active tab' : 'selected tabs';
  let context = `\n\n[Context from ${label}:]\n`;
  tabList.forEach((tab: any) => {
    const tabTitle = tab.title || 'Untitled';
    const groupLabel = tab.groupTitle ? `${tab.groupTitle} · ` : '';
    const urlLabel = tab.url || '';
    context += `- ${groupLabel}"${tabTitle}": ${urlLabel}\n`;
  });
  return context;
};
