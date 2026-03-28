/* Promise-based Chrome extension APIs for MV3 */
declare namespace chrome {
  namespace sidePanel {
    function setPanelBehavior(options: chrome.sidePanel.PanelBehavior): Promise<void>;
  }

  namespace sidebarAction {
    function open(options?: { windowId?: number }): Promise<void>;
  }

  namespace runtime {
    function sendMessage(message: any): Promise<any>;
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string[] | string | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }
  }

  namespace tabs {
    function query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
    function get(tabId: number): Promise<chrome.tabs.Tab>;
    function update(
      tabId: number,
      updateProperties: chrome.tabs.UpdateProperties,
    ): Promise<chrome.tabs.Tab | undefined>;
    function create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
    function remove(tabIds: number | number[]): Promise<void>;
    function group(options: chrome.tabs.GroupOptions): Promise<number>;
    function ungroup(tabIds: number | number[]): Promise<void>;
  }

  namespace tabGroups {
    function query(queryInfo?: chrome.tabGroups.QueryInfo): Promise<chrome.tabGroups.TabGroup[]>;
    function update(
      groupId: number,
      updateProperties: chrome.tabGroups.UpdateProperties,
    ): Promise<chrome.tabGroups.TabGroup>;
  }

  namespace scripting {
    function executeScript<Args extends any[], Result>(
      injection: chrome.scripting.ScriptInjection<Args>,
    ): Promise<Array<chrome.scripting.InjectionResult<Result>>>;
  }
}
