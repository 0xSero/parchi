import { asRecord } from '@parchi/shared';

export type RuntimeBrowser = 'chrome' | 'firefox';

export type RuntimeFeatureFlags = {
  browser: RuntimeBrowser;
  sidePanelBehavior: boolean;
  sidebarActionOpen: boolean;
  kimiHeaderViaDnr: boolean;
  kimiHeaderViaWebRequest: boolean;
};

export type KimiHeaderSetupResult = {
  ok: boolean;
  mode: 'dnr' | 'webRequest' | 'none';
  reason?: string;
};

const KIMI_DNR_RULE_ID = 9000;
const KIMI_UA_VALUE = 'coding-agent';
const KIMI_URL_PATTERN = '*://api.kimi.com/*';

type BrowserSidePanelBehaviorApi = {
  setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void> | void;
};

type BrowserSidebarActionApi = {
  open?: (options?: { windowId?: number }) => Promise<void> | void;
};

type BrowserDnrApi = {
  updateDynamicRules?: (rules: {
    removeRuleIds: number[];
    addRules: Array<Record<string, unknown>>;
  }) => Promise<void> | void;
  RuleActionType?: { MODIFY_HEADERS?: string };
  HeaderOperation?: { SET?: string };
  ResourceType?: { XMLHTTPREQUEST?: string };
};

type RuntimeChromeCompat = {
  sidePanel?: BrowserSidePanelBehaviorApi;
  declarativeNetRequest?: BrowserDnrApi;
  webRequest?: typeof chrome.webRequest;
};

const kimiWebRequestHeaderListener = (
  details: chrome.webRequest.WebRequestHeadersDetails,
): chrome.webRequest.BlockingResponse => {
  const input = Array.isArray(details.requestHeaders) ? details.requestHeaders : [];
  let sawUserAgent = false;
  const requestHeaders = input.map((header) => {
    const name = String(header.name || '');
    if (name.toLowerCase() === 'user-agent') {
      sawUserAgent = true;
      return {
        ...header,
        value: KIMI_UA_VALUE,
      };
    }
    return header;
  });

  if (!sawUserAgent) {
    requestHeaders.push({
      name: 'User-Agent',
      value: KIMI_UA_VALUE,
    });
  }

  return { requestHeaders };
};

const getBrowserSidebarAction = (): BrowserSidebarActionApi | null => {
  // sidebarAction is Firefox-specific — it lives on `browser`, not `chrome`
  const runtimeChrome = chrome as unknown as Record<string, unknown>;
  const runtimeBrowser = asRecord((globalThis as Record<string, unknown>).browser);
  return (
    (runtimeChrome.sidebarAction as BrowserSidebarActionApi | undefined) ||
    (runtimeBrowser?.sidebarAction as BrowserSidebarActionApi | undefined) ||
    null
  );
};

export const getRuntimeFeatureFlags = (): RuntimeFeatureFlags => {
  const runtimeChrome = chrome as unknown as RuntimeChromeCompat;
  const isFirefox = typeof (globalThis as Record<string, unknown>).browser !== 'undefined';
  const dnr = runtimeChrome?.declarativeNetRequest;
  const sidePanelApi = runtimeChrome?.sidePanel;
  const sidebarActionApi = getBrowserSidebarAction();
  const webRequestApi = runtimeChrome?.webRequest;
  return {
    browser: isFirefox ? 'firefox' : 'chrome',
    sidePanelBehavior: typeof sidePanelApi?.setPanelBehavior === 'function',
    sidebarActionOpen: typeof sidebarActionApi?.open === 'function',
    kimiHeaderViaDnr:
      typeof dnr?.updateDynamicRules === 'function' &&
      Boolean(dnr?.RuleActionType?.MODIFY_HEADERS) &&
      Boolean(dnr?.HeaderOperation?.SET) &&
      Boolean(dnr?.ResourceType?.XMLHTTPREQUEST),
    kimiHeaderViaWebRequest: Boolean(webRequestApi?.onBeforeSendHeaders?.addListener),
  };
};

export const setupActionClickOpensPanel = () => {
  const features = getRuntimeFeatureFlags();
  const runtimeChrome = chrome as unknown as RuntimeChromeCompat;
  if (features.sidePanelBehavior) {
    try {
      const maybePromise = runtimeChrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        (maybePromise as Promise<void>).catch((error) => console.warn('Failed to set side panel behavior:', error));
      }
    } catch (error) {
      console.warn('Failed to set side panel behavior:', error);
    }
    return;
  }

  if (features.sidebarActionOpen && chrome.action?.onClicked) {
    const sidebarApi = getBrowserSidebarAction();
    if (!sidebarApi?.open) return;
    chrome.action.onClicked.addListener((tab) => {
      const options = typeof tab?.windowId === 'number' ? { windowId: tab.windowId } : undefined;
      try {
        const maybePromise = sidebarApi.open?.(options) as Promise<void> | undefined;
        maybePromise?.catch((error) => console.error('Failed to open sidebar:', error));
      } catch (error) {
        console.error('Failed to open sidebar:', error);
      }
    });
  }
};

export const setupKimiUserAgentHeaderSupport = async (): Promise<KimiHeaderSetupResult> => {
  const features = getRuntimeFeatureFlags();
  if (features.kimiHeaderViaDnr) {
    const dnr = (chrome as unknown as RuntimeChromeCompat).declarativeNetRequest;
    try {
      const maybePromise = dnr?.updateDynamicRules?.({
        removeRuleIds: [KIMI_DNR_RULE_ID],
        addRules: [
          {
            id: KIMI_DNR_RULE_ID,
            priority: 1,
            action: {
              type: dnr?.RuleActionType?.MODIFY_HEADERS,
              requestHeaders: [
                {
                  header: 'User-Agent',
                  operation: dnr?.HeaderOperation?.SET,
                  value: KIMI_UA_VALUE,
                },
              ],
            },
            condition: {
              urlFilter: '||api.kimi.com',
              resourceTypes: [dnr?.ResourceType?.XMLHTTPREQUEST],
            },
          },
        ],
      });
      await maybePromise;
      return { ok: true, mode: 'dnr' };
    } catch (error) {
      return {
        ok: false,
        mode: 'none',
        reason: error instanceof Error ? error.message : String(error ?? 'Failed to set DNR rule'),
      };
    }
  }

  if (features.kimiHeaderViaWebRequest) {
    try {
      if (chrome.webRequest.onBeforeSendHeaders.hasListener(kimiWebRequestHeaderListener)) {
        return { ok: true, mode: 'webRequest' };
      }

      try {
        chrome.webRequest.onBeforeSendHeaders.addListener(kimiWebRequestHeaderListener, { urls: [KIMI_URL_PATTERN] }, [
          'blocking',
          'requestHeaders',
          'extraHeaders',
        ]);
      } catch {
        // Some Firefox versions reject "extraHeaders"; fall back to the core blocking options.
        chrome.webRequest.onBeforeSendHeaders.addListener(kimiWebRequestHeaderListener, { urls: [KIMI_URL_PATTERN] }, [
          'blocking',
          'requestHeaders',
        ]);
      }
      return { ok: true, mode: 'webRequest' };
    } catch (error) {
      return {
        ok: false,
        mode: 'none',
        reason: error instanceof Error ? error.message : String(error ?? 'Failed to set webRequest listener'),
      };
    }
  }

  return {
    ok: false,
    mode: 'none',
    reason: 'No supported header rewrite API found',
  };
};
