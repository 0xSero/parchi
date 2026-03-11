import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.toggleTabSelector = async function toggleTabSelector() {
  const isHidden = this.elements.tabSelector.classList.contains('hidden');
  if (isHidden) {
    await this.loadTabs();
    this.updateTabSelectorButton();
    this.elements.tabSelector.classList.remove('hidden');
  } else {
    this.closeTabSelector();
  }
};

sidePanelProto.closeTabSelector = function closeTabSelector() {
  this.elements.tabSelector.classList.add('hidden');
};

sidePanelProto.loadTabs = async function loadTabs() {
  const tabGroupsApi = chrome.tabGroups;
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({}),
    tabGroupsApi?.query ? tabGroupsApi.query({}) : Promise.resolve([]),
  ]);
  this.tabGroupInfo = new Map(groups.map((group) => [group.id, group]));
  this.elements.tabList.innerHTML = '';

  const groupedTabs = new Map<number, chrome.tabs.Tab[]>();
  const ungroupedTabs: chrome.tabs.Tab[] = [];

  tabs
    .filter((tab) => typeof tab.id === 'number')
    .forEach((tab) => {
      const groupId = typeof tab.groupId === 'number' ? tab.groupId : -1;
      if (groupId >= 0) {
        if (!groupedTabs.has(groupId)) groupedTabs.set(groupId, []);
        const bucket = groupedTabs.get(groupId);
        if (bucket) bucket.push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

  const renderGroup = (label: string, color: string, groupTabs: chrome.tabs.Tab[]) => {
    if (!groupTabs.length) return;
    const section = document.createElement('div');
    section.className = 'tab-group';
    const allSelected = groupTabs.every((tab) => typeof tab.id === 'number' && this.selectedTabs.has(tab.id));
    section.innerHTML = `
        <div class="tab-group-header" style="--group-color: ${color}">
          <div class="tab-group-label">
            <span>${this.escapeHtml(label)}</span>
            <span class="tab-group-count">${groupTabs.length}</span>
          </div>
          <button class="tab-group-toggle" type="button">${allSelected ? 'Clear' : 'Add all'}</button>
        </div>
      `;

    const toggleBtn = section.querySelector('.tab-group-toggle');
    toggleBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleGroupSelection(groupTabs, !allSelected);
    });

    groupTabs.forEach((tab) => {
      const tabId = tab.id;
      const isSelected = typeof tabId === 'number' && this.selectedTabs.has(tabId);
      const item = document.createElement('div');
      item.className = `tab-item${isSelected ? ' selected' : ''}`;
      const urlLabel = this.formatTabLabel(tab.url || '');
      item.innerHTML = `
          <div class="tab-item-checkbox"></div>
          <img class="tab-item-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'">
          <div class="tab-item-text">
            <span class="tab-item-title">${this.escapeHtml(tab.title || 'Untitled')}</span>
            ${urlLabel ? `<span class=\"tab-item-url\">${this.escapeHtml(urlLabel)}</span>` : ''}
          </div>
        `;
      item.addEventListener('click', () => this.toggleTabSelection(tab, item));
      section.appendChild(item);
    });

    this.elements.tabList.appendChild(section);
  };

  groupedTabs.forEach((groupTabs, groupId) => {
    const group = this.tabGroupInfo.get(groupId);
    const label = group?.title || `Group ${groupId}`;
    const color = this.mapGroupColor(group?.color);
    renderGroup(label, color, groupTabs);
  });

  renderGroup('Ungrouped', 'var(--text-tertiary)', ungroupedTabs);
};

sidePanelProto.toggleGroupSelection = function toggleGroupSelection(
  groupTabs: chrome.tabs.Tab[],
  shouldSelect: boolean,
) {
  groupTabs.forEach((tab) => {
    if (typeof tab.id !== 'number') return;
    if (shouldSelect) {
      this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
    } else {
      this.selectedTabs.delete(tab.id);
    }
  });
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};

sidePanelProto.toggleTabSelection = function toggleTabSelection(tab: chrome.tabs.Tab, itemElement: HTMLElement) {
  if (typeof tab.id !== 'number') return;
  if (this.selectedTabs.has(tab.id)) {
    this.selectedTabs.delete(tab.id);
    itemElement.classList.remove('selected');
  } else {
    this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
    itemElement.classList.add('selected');
  }
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};
