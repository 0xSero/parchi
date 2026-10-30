// Records the remote address the browser actually connected to for each committed frame document (webRequest `ip`
// bound to webNavigation.onCommitted `documentId`), plus private-address subresources per document (issue #42).
// Ordinary-looking DNS names that resolve to loopback/LAN space and private iframes are visible here. Subresource
// provenance is best-effort: only responses webRequest attributes to a tab's loading document are recorded (service
// worker, popup, removed-frame or postMessage relays are not). webRequest/webNavigation are observational only:
// requests have already been sent when these events fire, so nothing here prevents request side effects.
import { isPrivateIpAddress, isPrivateNetworkUrl } from './private-network.js';

type ObserverState = {
  /** `${tabId}:${frameId}` -> last frame response not yet committed (204s/downloads never commit). */
  pending: Record<string, { url: string; ip: string }>;
  /** document key -> origin + remote ip ('' = no address observed) of that committed document. */
  docs: Record<string, { origin: string; ip: string }>;
  /** tabId -> document key of the committed main-frame document (used for script-free tab listings). */
  mainDocs: Record<string, string>;
  /** document key -> origins of private responses attributed to that loading document (best-effort). */
  docPrivate: Record<string, string[]>;
  /** root session id -> origins of approved private content the agent has read (private-read taint). */
  sessions: Record<string, string[]>;
};

type ResponseDetails = { url: string; ip?: string; tabId: number; frameId: number; type: string; documentId?: string };
type CommitDetails = { url: string; tabId: number; frameId: number; documentId?: string };

const STORAGE_KEY = 'parchiNetworkObserver';
const MAX_ENTRIES = 2000;

const emptyState = (): ObserverState => ({ pending: {}, docs: {}, mainDocs: {}, docPrivate: {}, sessions: {} });
let state: ObserverState = emptyState();
let ready: Promise<void> = Promise.resolve();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const sessionStorage = () => (globalThis as { chrome?: typeof chrome }).chrome?.storage?.session;

/** Chrome reports documentId on commits and probes; Firefox does not, so fall back to the frame slot. */
export const documentKey = (documentId: string | undefined, tabId: number, frameId: number) =>
  documentId || `frame:${tabId}:${frameId}`;

const withoutFragment = (url: string) => url.split('#')[0];

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function put<T>(record: Record<string, T>, key: string, value: T) {
  delete record[key];
  record[key] = value;
  const keys = Object.keys(record);
  for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete record[stale];
  scheduleSave();
}

function scheduleSave() {
  const storage = sessionStorage();
  if (!storage || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void storage.set({ [STORAGE_KEY]: state }).catch(() => {});
  }, 200);
}

function addUnique(record: Record<string, string[]>, key: string, value: string) {
  const list = record[key] || [];
  if (!list.includes(value)) put(record, key, [...list, value]);
}

/** Applies one webRequest.onResponseStarted observation. Exported for tests. */
export function recordResponse(details: ResponseDetails) {
  const origin = originOf(details.url);
  if (!origin || details.tabId < 0) return;
  if (details.type === 'main_frame' || details.type === 'sub_frame') {
    // Not bound to any document until it commits; a 204, download or cancelled navigation never does.
    put(state.pending, `${details.tabId}:${details.frameId}`, { url: details.url, ip: details.ip || '' });
    return;
  }
  const isPrivate = (details.ip && isPrivateIpAddress(details.ip)) || isPrivateNetworkUrl(details.url);
  if (isPrivate && details.documentId) addUnique(state.docPrivate, details.documentId, origin);
}

/** Drops a frame's pending response when a new navigation starts or fails, so it can never bind to a later commit. */
export function clearPending(details: { tabId: number; frameId: number }) {
  if (state.pending[`${details.tabId}:${details.frameId}`]) {
    delete state.pending[`${details.tabId}:${details.frameId}`];
    scheduleSave();
  }
}

/** Applies one webNavigation.onCommitted observation. Exported for tests. */
export function recordCommit(details: CommitDetails) {
  const slot = `${details.tabId}:${details.frameId}`;
  const key = documentKey(details.documentId, details.tabId, details.frameId);
  const response = state.pending[slot];
  delete state.pending[slot];
  if (response && withoutFragment(response.url) === withoutFragment(details.url)) {
    put(state.docs, key, { origin: originOf(details.url), ip: response.ip });
  } else if (!state.docs[key] || !details.documentId) {
    // Committed without an observed response (service worker, about:blank, history restore of an unknown
    // document): record it as unobserved. A known document restored by id keeps its record.
    put(state.docs, key, { origin: originOf(details.url), ip: '' });
  }
  if (details.frameId === 0) put(state.mainDocs, String(details.tabId), key);
}

export function installNetworkObserver() {
  const api = (globalThis as { chrome?: typeof chrome }).chrome;
  const storage = sessionStorage();
  ready = storage
    ? storage
        .get(STORAGE_KEY)
        .then((stored) => {
          const saved = stored?.[STORAGE_KEY] as Partial<ObserverState> | undefined;
          if (!saved) return;
          // Events observed before the restore finished win over persisted values.
          for (const field of Object.keys(state) as Array<keyof ObserverState>) {
            state[field] = { ...(saved[field] || {}), ...state[field] } as never;
          }
        })
        .catch(() => {})
    : Promise.resolve();
  api?.webRequest?.onResponseStarted?.addListener((details) => recordResponse(details as ResponseDetails), {
    urls: ['<all_urls>'],
  });
  api?.webNavigation?.onCommitted?.addListener((details) => recordCommit(details as CommitDetails));
  api?.webNavigation?.onBeforeNavigate?.addListener(clearPending);
  api?.webNavigation?.onErrorOccurred?.addListener(clearPending);
  api?.tabs?.onRemoved?.addListener((tabId) => {
    delete state.mainDocs[String(tabId)];
    for (const key of Object.keys(state.pending)) if (key.startsWith(`${tabId}:`)) delete state.pending[key];
    scheduleSave();
  });
}

export type NetworkObservation = {
  /** Observed remote ip of a committed document: undefined = never committed/seen, '' = committed unobserved. */
  documentIp(key: string): { origin: string; ip: string } | undefined;
  mainDocumentKey(tabId: number): string | undefined;
  documentPrivateOrigins(key: string | undefined): string[];
};

export async function getNetworkObservation(): Promise<NetworkObservation> {
  await ready;
  return {
    documentIp: (key) => state.docs[key],
    mainDocumentKey: (tabId) => state.mainDocs[String(tabId)],
    documentPrivateOrigins: (key) => (key ? state.docPrivate[key] || [] : []),
  };
}

const rootSession = (sessionId: string) => sessionId.split('::')[0] || sessionId;

/** Marks that the agent session (and its subagents) has read approved private-network content. */
export function markPrivateRead(sessionId: string, origin: string) {
  addUnique(state.sessions, rootSession(sessionId), origin || 'private');
}

export async function getPrivateReads(sessionId: string) {
  await ready;
  return state.sessions[rootSession(sessionId)] || [];
}

/** Test helper: reset all observations. */
export function resetNetworkObserver() {
  state = emptyState();
}
