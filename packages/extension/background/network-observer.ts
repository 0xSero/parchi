// Records the remote address the browser actually connected to for each frame document and subresource
// (webRequest `ip`), so destination policy does not depend on hostname strings alone (issue #42). Ordinary-looking
// DNS names that resolve to loopback/LAN space, DNS rebinding of subresources and private iframes are all visible here.
import { isPrivateIpAddress, isPrivateNetworkUrl } from './private-network.js';

type ObserverState = {
  /** `${tabId}:${frameId}` -> origin + remote ip of the document currently loaded in that frame. */
  frames: Record<string, { origin: string; ip: string }>;
  /** origin -> most recently observed remote ip (any tab, including service-worker fetches). */
  origins: Record<string, string>;
  /** documentId -> origins of private-address responses that document loaded (rebinding, private img/xhr). */
  docPrivate: Record<string, string[]>;
  /** root session id -> origins of approved private content the agent has read (private-read taint). */
  sessions: Record<string, string[]>;
};

type ResponseDetails = {
  url: string;
  ip?: string;
  tabId: number;
  frameId: number;
  type: string;
  documentId?: string;
};

const STORAGE_KEY = 'parchiNetworkObserver';
const MAX_ENTRIES = 2000;

const state: ObserverState = { frames: {}, origins: {}, docPrivate: {}, sessions: {} };
let ready: Promise<void> = Promise.resolve();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const sessionStorage = () => (globalThis as { chrome?: typeof chrome }).chrome?.storage?.session;

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function capped(record: Record<string, unknown>) {
  const keys = Object.keys(record);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete record[key];
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
  if (list.includes(value)) return;
  delete record[key];
  record[key] = [...list, value];
  capped(record);
  scheduleSave();
}

/** Applies one webRequest response observation. Exported for tests. */
export function recordResponse(details: ResponseDetails) {
  const origin = originOf(details.url);
  if (!origin || !details.ip) return;
  const isPrivate = isPrivateIpAddress(details.ip) || isPrivateNetworkUrl(details.url);
  if (state.origins[origin] !== details.ip) {
    delete state.origins[origin];
    state.origins[origin] = details.ip;
    capped(state.origins);
  }
  if (details.tabId >= 0 && (details.type === 'main_frame' || details.type === 'sub_frame')) {
    if (details.type === 'main_frame') {
      for (const key of Object.keys(state.frames)) if (key.startsWith(`${details.tabId}:`)) delete state.frames[key];
    }
    state.frames[`${details.tabId}:${details.frameId}`] = { origin, ip: details.ip };
    capped(state.frames);
  } else if (isPrivate && details.documentId) {
    addUnique(state.docPrivate, details.documentId, origin);
  }
  scheduleSave();
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
          state.frames = { ...saved.frames, ...state.frames };
          state.origins = { ...saved.origins, ...state.origins };
          state.docPrivate = { ...saved.docPrivate, ...state.docPrivate };
          state.sessions = { ...saved.sessions, ...state.sessions };
        })
        .catch(() => {})
    : Promise.resolve();
  api?.webRequest?.onResponseStarted?.addListener((details) => recordResponse(details as ResponseDetails), {
    urls: ['<all_urls>'],
  });
  api?.tabs?.onRemoved?.addListener((tabId) => {
    for (const key of Object.keys(state.frames)) if (key.startsWith(`${tabId}:`)) delete state.frames[key];
    scheduleSave();
  });
}

export type NetworkObservation = {
  frameIp(tabId: number, frameId: number, origin: string): string | undefined;
  originIp(origin: string): string | undefined;
  documentPrivateOrigins(documentId: string | undefined): string[];
};

export async function getNetworkObservation(): Promise<NetworkObservation> {
  await ready;
  return {
    frameIp: (tabId, frameId, origin) => {
      const frame = state.frames[`${tabId}:${frameId}`];
      return frame && frame.origin === origin ? frame.ip : undefined;
    },
    originIp: (origin) => state.origins[origin],
    documentPrivateOrigins: (documentId) => (documentId ? state.docPrivate[documentId] || [] : []),
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
  state.frames = {};
  state.origins = {};
  state.docPrivate = {};
  state.sessions = {};
}
