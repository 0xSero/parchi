// Minimal in-memory Chrome for exercising the real BrowserTools + tool gate without a browser. Frames are synthetic;
// nothing here performs network I/O. executeScript mirrors Chrome's documentIds semantics: injecting into a document
// that has been replaced throws.

export type FakeFrame = { frameId: number; documentId: string; url: string; origin?: string; content: string };
export type FakeTab = {
  id: number;
  windowId: number;
  url: string;
  title: string;
  pendingUrl?: string;
  active: boolean;
  frames: FakeFrame[];
};

let docCounter = 0;
export const newDocumentId = () => `DOC${++docCounter}`;

export class FakeBrowser {
  tabs = new Map<number, FakeTab>();
  injections: Array<{ tabId: number; target: Record<string, unknown> }> = [];
  createdUrls: string[] = [];
  debuggerListeners: Array<(source: { tabId: number }, method: string, params: Record<string, unknown>) => void> = [];
  responseBodies = new Map<string, string>();
  /** Called once before the next non-probe injection runs (simulates navigation racing a tool call). */
  beforeNextInjection: (() => void) | null = null;
  /** Called when a navigation starts (tabs.update/create with a url); tests use it to commit + observe the load. */
  onNavigate: ((tabId: number, url: string) => void) | null = null;

  addTab(tab: Partial<FakeTab> & { id: number; url: string }) {
    const full: FakeTab = {
      windowId: 1,
      title: `title of ${tab.url}`,
      active: false,
      frames: [{ frameId: 0, documentId: newDocumentId(), url: tab.url, content: `content of ${tab.url}` }],
      ...tab,
    };
    if (full.active) for (const other of this.tabs.values()) if (other.windowId === full.windowId) other.active = false;
    this.tabs.set(full.id, full);
    return full;
  }

  /** Commits a navigation in the tab's main frame (new document). */
  commit(tabId: number, url: string, extraFrames: FakeFrame[] = []) {
    const tab = this.tabs.get(tabId);
    if (!tab) throw new Error(`no tab ${tabId}`);
    tab.url = url;
    tab.title = `title of ${url}`;
    tab.pendingUrl = undefined;
    tab.frames = [{ frameId: 0, documentId: newDocumentId(), url, content: `content of ${url}` }, ...extraFrames];
    return tab.frames[0];
  }

  private selectFrames(tab: FakeTab, target: Record<string, unknown>) {
    if (Array.isArray(target.documentIds)) {
      return (target.documentIds as string[]).map((id) => {
        const frame = tab.frames.find((entry) => entry.documentId === id);
        if (!frame) throw new Error(`No document with id ${id}`);
        return frame;
      });
    }
    if (Array.isArray(target.frameIds)) {
      return tab.frames.filter((frame) => (target.frameIds as number[]).includes(frame.frameId));
    }
    return target.allFrames ? tab.frames : tab.frames.filter((frame) => frame.frameId === 0);
  }

  install() {
    const state = globalThis as typeof globalThis & { chrome?: typeof chrome };
    const original = state.chrome;
    const tabOf = (id: number) => {
      const tab = this.tabs.get(id);
      if (!tab) throw new Error(`No tab with id: ${id}`);
      return tab;
    };
    const publicTab = (tab: FakeTab) => ({ ...tab, frames: undefined });
    state.chrome = {
      runtime: { id: 'ext-id', getURL: (path: string) => `chrome-extension://ext-id/${path}`, lastError: undefined },
      windows: { update: async () => ({}) },
      tabs: {
        get: async (id: number) => publicTab(tabOf(id)),
        query: async (query: { active?: boolean; windowId?: number }) =>
          [...this.tabs.values()]
            .filter((tab) => (query.active ? tab.active : true))
            .filter((tab) => (typeof query.windowId === 'number' ? tab.windowId === query.windowId : true))
            .map(publicTab),
        update: async (id: number, props: { url?: string; active?: boolean }) => {
          const tab = tabOf(id);
          if (props.url) {
            tab.pendingUrl = props.url;
            this.onNavigate?.(id, props.url);
          }
          return publicTab(tab);
        },
        create: async (props: { url: string; active?: boolean; windowId?: number }) => {
          const id = 900 + this.tabs.size;
          this.createdUrls.push(props.url);
          const tab = this.addTab({ id, url: 'about:blank', active: props.active !== false });
          tab.pendingUrl = props.url;
          this.onNavigate?.(id, props.url);
          return publicTab(tab);
        },
        sendMessage: async () => ({}),
        captureVisibleTab: async (windowId: number) => {
          const visible = [...this.tabs.values()].find((tab) => tab.windowId === windowId && tab.active);
          return `data:image/jpeg;base64,${btoa(visible?.frames.map((frame) => frame.content).join('|') || '')}`;
        },
        onRemoved: { addListener: () => {} },
      },
      scripting: {
        executeScript: async (details: { target: Record<string, unknown>; func: () => unknown }) => {
          const tab = tabOf(details.target.tabId as number);
          const isProbe = String(details.func).includes('self.origin');
          if (!isProbe) {
            const hook = this.beforeNextInjection;
            this.beforeNextInjection = null;
            hook?.();
            this.injections.push({ tabId: tab.id, target: details.target });
          }
          return this.selectFrames(tab, details.target).map((frame) => ({
            frameId: frame.frameId,
            documentId: frame.documentId,
            result: isProbe
              ? { url: frame.url, origin: frame.origin ?? new URL(frame.url).origin }
              : { success: true, content: frame.content },
          }));
        },
      },
      debugger: {
        onEvent: {
          addListener: (listener: FakeBrowser['debuggerListeners'][number]) => this.debuggerListeners.push(listener),
        },
        onDetach: { addListener: () => {} },
        attach: (_target: unknown, _version: string, callback: () => void) => callback(),
        sendCommand: (
          _target: unknown,
          method: string,
          params: { requestId?: string },
          callback: (r: unknown) => void,
        ) =>
          callback(
            method === 'Network.getResponseBody' ? { body: this.responseBodies.get(String(params?.requestId)) } : {},
          ),
      },
    } as unknown as typeof chrome;
    return () => {
      state.chrome = original;
    };
  }

  /** Emits a CDP request/response pair to every attached debugger listener. */
  async emitNetwork(tabId: number, requestId: string, url: string, remoteIPAddress: string | undefined, body: string) {
    this.responseBodies.set(requestId, body);
    const emit = (method: string, params: Record<string, unknown>) =>
      this.debuggerListeners.forEach((listener) => listener({ tabId }, method, params));
    emit('Network.requestWillBeSent', { requestId, request: { url, method: 'GET' }, type: 'Fetch' });
    emit('Network.responseReceived', { requestId, response: { status: 200, remoteIPAddress }, type: 'Fetch' });
    emit('Network.loadingFinished', { requestId });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
