import {
  type BrowserNetworkLogEntry,
  type BrowserToolArgs,
  type BrowserToolResult,
  type BrowserToolsDelegate,
  formatToolError,
  missingSessionTabError,
} from './browser-tool-shared.js';

type DebugTarget = chrome.debugger.Debuggee;

type NetworkRequestDraft = BrowserNetworkLogEntry & {
  requestId: string;
};

type DebugSession = {
  attached: boolean;
  networkEnabled: boolean;
  requests: Map<string, NetworkRequestDraft>;
  logs: BrowserNetworkLogEntry[];
};

const MAX_NETWORK_LOGS = 100;
const MAX_NETWORK_BODY_CHARS = 20_000;

const targetForTab = (tabId: number): DebugTarget => ({ tabId });

const normalizeHeaders = (headers: Record<string, unknown> | undefined): Record<string, string> | undefined => {
  if (!headers || typeof headers !== 'object') return undefined;
  const entries = Object.entries(headers)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
};

export class BrowserDebugManager {
  private sessions = new Map<number, DebugSession>();
  private listenersBound = false;

  constructor() {
    this.bindListeners();
  }

  async watchNetwork(tabId: number, clearExisting = true): Promise<BrowserToolResult> {
    const session = await this.ensureAttached(tabId);
    if (!session.networkEnabled) {
      await this.sendCommand(tabId, 'Network.enable');
      session.networkEnabled = true;
    }
    if (clearExisting) {
      session.requests.clear();
      session.logs = [];
    }
    return {
      success: true,
      attached: true,
      networkEnabled: true,
      retainedEntries: session.logs.length,
    };
  }

  async getNetworkLog(
    tabId: number,
    options: {
      urlIncludes?: string;
      method?: string;
      status?: number;
      limit?: number;
      includeBody?: boolean;
      clearAfterRead?: boolean;
    } = {},
  ): Promise<BrowserToolResult<{ success: true; entries: BrowserNetworkLogEntry[] }>> {
    const session = await this.ensureAttached(tabId);
    if (!session.networkEnabled) {
      await this.watchNetwork(tabId, false);
    }

    const urlIncludes = String(options.urlIncludes || '')
      .trim()
      .toLowerCase();
    const method = String(options.method || '')
      .trim()
      .toUpperCase();
    const status = typeof options.status === 'number' ? options.status : null;
    const limit = Math.max(1, Math.min(50, Math.floor(Number(options.limit) || 20)));
    const includeBody = options.includeBody === true;

    const entries = session.logs
      .filter((entry) => {
        if (urlIncludes && !entry.url.toLowerCase().includes(urlIncludes)) return false;
        if (method && entry.method.toUpperCase() !== method) return false;
        if (status !== null && Number(entry.status || 0) !== status) return false;
        return true;
      })
      .slice(-limit)
      .reverse()
      .map((entry) => ({
        ...entry,
        ...(includeBody ? {} : { body: undefined }),
      }));

    if (options.clearAfterRead === true) {
      session.logs = [];
      session.requests.clear();
    }

    return {
      success: true,
      entries,
    };
  }

  private bindListeners() {
    if (this.listenersBound) return;
    chrome.debugger.onEvent.addListener((source, method, params) => {
      void this.handleEvent(source, method, (params || {}) as Record<string, any>);
    });
    chrome.debugger.onDetach.addListener((source) => {
      if (typeof source.tabId === 'number') {
        this.sessions.delete(source.tabId);
      }
    });
    this.listenersBound = true;
  }

  private async ensureAttached(tabId: number): Promise<DebugSession> {
    const existing = this.sessions.get(tabId);
    if (existing?.attached) return existing;

    await this.attach(tabId);
    const session: DebugSession = existing || {
      attached: true,
      networkEnabled: false,
      requests: new Map(),
      logs: [],
    };
    session.attached = true;
    this.sessions.set(tabId, session);
    return session;
  }

  private async attach(tabId: number) {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(targetForTab(tabId), '1.3', () => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError && !runtimeError.message?.includes('Another debugger is already attached')) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve();
      });
    });
  }

  private async sendCommand<TResult = unknown>(
    tabId: number,
    method: string,
    commandParams: Record<string, unknown> = {},
  ) {
    return await new Promise<TResult>((resolve, reject) => {
      chrome.debugger.sendCommand(targetForTab(tabId), method, commandParams, (result) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(result as TResult);
      });
    });
  }

  private async handleEvent(source: DebugTarget, method: string, params: Record<string, any>) {
    if (typeof source.tabId !== 'number') return;
    const session = this.sessions.get(source.tabId);
    if (!session) return;

    switch (method) {
      case 'Network.requestWillBeSent': {
        const request = params.request || {};
        session.requests.set(String(params.requestId), {
          requestId: String(params.requestId),
          url: String(request.url || ''),
          method: String(request.method || 'GET'),
          requestHeaders: normalizeHeaders(request.headers),
          resourceType: typeof params.type === 'string' ? params.type : undefined,
          startedAt: Date.now(),
        });
        break;
      }
      case 'Network.responseReceived': {
        const requestId = String(params.requestId);
        const draft = session.requests.get(requestId);
        if (!draft) break;
        const response = params.response || {};
        draft.status = Number(response.status || 0) || undefined;
        draft.statusText = typeof response.statusText === 'string' ? response.statusText : undefined;
        draft.mimeType = typeof response.mimeType === 'string' ? response.mimeType : undefined;
        draft.responseHeaders = normalizeHeaders(response.headers);
        draft.resourceType = typeof params.type === 'string' ? params.type : draft.resourceType;
        break;
      }
      case 'Network.loadingFailed': {
        const requestId = String(params.requestId);
        const draft = session.requests.get(requestId);
        if (!draft) break;
        this.pushLog(session, {
          ...draft,
          failed: true,
          errorText: typeof params.errorText === 'string' ? params.errorText : 'Network request failed',
          finishedAt: Date.now(),
        });
        session.requests.delete(requestId);
        break;
      }
      case 'Network.loadingFinished': {
        const requestId = String(params.requestId);
        const draft = session.requests.get(requestId);
        if (!draft) break;
        await this.finalizeRequest(source.tabId, session, draft);
        session.requests.delete(requestId);
        break;
      }
      default:
        break;
    }
  }

  private async finalizeRequest(tabId: number, session: DebugSession, draft: NetworkRequestDraft) {
    let body: string | undefined;
    let bodyTruncated = false;
    try {
      const response = await this.sendCommand<{ body?: string; base64Encoded?: boolean }>(
        tabId,
        'Network.getResponseBody',
        {
          requestId: draft.requestId,
        },
      );
      if (typeof response?.body === 'string') {
        body = response.base64Encoded ? atob(response.body) : response.body;
        if (body.length > MAX_NETWORK_BODY_CHARS) {
          body = `${body.slice(0, MAX_NETWORK_BODY_CHARS)}…`;
          bodyTruncated = true;
        }
      }
    } catch {
      // Ignore body fetch failures for opaque or binary responses.
    }

    this.pushLog(session, {
      ...draft,
      body,
      bodyTruncated,
      finishedAt: Date.now(),
    });
  }

  private pushLog(session: DebugSession, entry: NetworkRequestDraft | BrowserNetworkLogEntry) {
    const { requestId: _requestId, ...rest } = entry as NetworkRequestDraft;
    session.logs.push(rest);
    if (session.logs.length > MAX_NETWORK_LOGS) {
      session.logs.splice(0, session.logs.length - MAX_NETWORK_LOGS);
    }
  }
}

export async function watchNetworkTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();
  await ctx.sendOverlay(tabId, {
    label: 'Watch network',
    note: 'capture fetch/xhr responses',
    durationMs: 800,
  });
  try {
    return await ctx.watchNetwork(tabId, args.clearExisting !== false);
  } catch (error) {
    return {
      success: false,
      error: 'Network capture failed.',
      details: formatToolError(error),
    };
  }
}

export async function getNetworkLogTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();
  await ctx.sendOverlay(tabId, {
    label: 'Read network log',
    note: 'recent requests',
    durationMs: 700,
  });
  try {
    return await ctx.readNetworkLog(tabId, {
      urlIncludes: typeof args.urlIncludes === 'string' ? args.urlIncludes : undefined,
      method: typeof args.method === 'string' ? args.method : undefined,
      status: typeof args.status === 'number' ? args.status : undefined,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
      includeBody: args.includeBody === true,
      clearAfterRead: args.clearAfterRead === true,
    });
  } catch (error) {
    return {
      success: false,
      error: 'Unable to read network log.',
      details: formatToolError(error),
    };
  }
}
