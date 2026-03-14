export type SessionTabSummary = {
  id: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  windowId?: number;
};

export type GroupOptions = {
  title?: string;
  color?: chrome.tabGroups.ColorEnum;
};

export type ActionOverlayPayload = {
  label: string;
  selector?: string;
  note?: string;
  status?: 'running' | 'done' | 'error';
  durationMs?: number;
  bringIntoView?: boolean;
};

export type WaitTimeoutResolution = {
  timeoutMs: number;
  wasClamped: boolean;
};

export type BrowserToolErrorResult = {
  success: false;
  error: string;
  details?: string;
  hint?: string;
  [key: string]: unknown;
};

export type BrowserToolArgs = Record<string, unknown>;

export type BrowserToolResult<TResult = unknown> = TResult | BrowserToolErrorResult;

export type BrowserToolSuccessResult = {
  success: true;
  [key: string]: unknown;
};

export type BrowserNetworkLogEntry = {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  resourceType?: string;
  mimeType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  body?: string;
  bodyTruncated?: boolean;
  failed?: boolean;
  errorText?: string;
  startedAt: number;
  finishedAt?: number;
};

export interface BrowserToolsDelegate {
  sessionTabs: Map<number, SessionTabSummary>;
  currentSessionTabId: number | null;
  sessionTabGroupId: number | null;
  supportsTabGroups: boolean;
  screenshotQuality: 'high' | 'medium' | 'low' | undefined;
  getSessionTabSummaries(): SessionTabSummary[];
  getGroupTitle(options: GroupOptions): string;
  updateGroupTitle(): Promise<void>;
  groupTabsInternal(tabIds: number[], options: GroupOptions): Promise<void>;
  resolveTabId(args?: BrowserToolArgs): Promise<number | null>;
  resolveSessionWindowId(): Promise<number | undefined>;
  captureActiveTab(): Promise<number | null>;
  runInTab<TArgs extends unknown[], TResult>(
    tabId: number,
    func: (...args: TArgs) => TResult | Promise<TResult>,
    args: TArgs,
  ): Promise<BrowserToolResult<TResult>>;
  runInAllFrames<TArgs extends unknown[], TResult>(
    tabId: number,
    func: (...args: TArgs) => TResult | Promise<TResult>,
    args: TArgs,
  ): Promise<BrowserToolResult<TResult>>;
  watchNetwork(tabId: number, clearExisting?: boolean): Promise<BrowserToolResult>;
  readNetworkLog(
    tabId: number,
    options?: {
      urlIncludes?: string;
      method?: string;
      status?: number;
      limit?: number;
      includeBody?: boolean;
      clearAfterRead?: boolean;
    },
  ): Promise<BrowserToolResult<{ success: true; entries: BrowserNetworkLogEntry[] }>>;
  sendOverlay(tabId: number, payload: ActionOverlayPayload, retries?: number): Promise<void>;
}

export const MAX_SESSION_TABS = 5;

export const DEFAULT_SESSION_GROUP: Required<GroupOptions> = {
  title: 'Parchi',
  color: 'blue',
};

export const DEFAULT_WAIT_TIMEOUT_MS = 5000;
export const MAX_WAIT_TIMEOUT_MS = 15_000;

export const resolveWaitTimeoutMs = (rawValue: unknown): WaitTimeoutResolution => {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return {
      timeoutMs: DEFAULT_WAIT_TIMEOUT_MS,
      wasClamped: false,
    };
  }
  const normalized = Math.max(0, rawValue);
  const clamped = Math.min(normalized, MAX_WAIT_TIMEOUT_MS);
  return {
    timeoutMs: clamped,
    wasClamped: clamped !== normalized,
  };
};

export const missingSessionTabError = (): BrowserToolErrorResult => ({
  success: false,
  error: 'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
});

export const formatToolError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const isToolFailure = (value: unknown): value is BrowserToolErrorResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserToolErrorResult>;
  return candidate.success === false && typeof candidate.error === 'string';
};

export const isToolSuccess = (value: unknown): value is BrowserToolSuccessResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserToolSuccessResult>;
  return candidate.success === true;
};
