import { BrowserTools } from '../tools/browser-tools.js';
import { estimateDataUrlBytes, trimReportImages } from './report-images.js';
import type { SessionState } from './service-types.js';
import { defaultTokenVisibility } from './session-tokens.js';

// Keep enough room for the primary session plus spawned subagent sessions
// without evicting active orchestrator state mid-run.
export const MAX_SESSIONS = 24;
export const MAX_FAILURE_TRACKER_ENTRIES = 250;

// Re-export from session-tokens for backward compatibility
export {
  defaultTokenVisibility,
  emitTokenTrace,
  getTokenVisibilitySnapshot,
  normalizeContextPercent,
  updateSessionTokenVisibility,
} from './session-tokens.js';

// Re-export from session-lifecycle for backward compatibility
export {
  cleanupRun,
  isRunCancelled,
  registerActiveRun,
  sendRuntime,
  stopAllSidepanelRuns,
  stopRun,
  stopRunBySession,
} from './session-lifecycle.js';

function ensureSessionCollections(existing: SessionState) {
  if (!Array.isArray(existing.reportImages)) existing.reportImages = [];
  if (!(existing.selectedReportImageIds instanceof Set)) {
    existing.selectedReportImageIds = new Set<string>();
  }
  if (!Number.isFinite(existing.reportImageBytes)) {
    existing.reportImageBytes = existing.reportImages.reduce(
      (sum, image) => sum + estimateDataUrlBytes(String(image?.dataUrl || '')),
      0,
    );
  }
  if (!existing.tokenVisibility || typeof existing.tokenVisibility !== 'object') {
    existing.tokenVisibility = defaultTokenVisibility();
  }
  if (!existing.runningSubagents) existing.runningSubagents = new Map();
  if (!existing.subagentHistory) existing.subagentHistory = new Map();
  if (!existing.orchestratorWhiteboard) existing.orchestratorWhiteboard = new Map();
  if (!Object.prototype.hasOwnProperty.call(existing, 'orchestratorPlan')) {
    existing.orchestratorPlan = null;
  }
}

export function getSessionState(sessionStateById: Map<string, SessionState>, sessionId: string): SessionState {
  const id = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default';
  const existing = sessionStateById.get(id);
  if (existing) {
    ensureSessionCollections(existing);
    trimReportImages(existing);
    return existing;
  }
  // Evict oldest sessions when at capacity
  if (sessionStateById.size >= MAX_SESSIONS) {
    const oldestKey = sessionStateById.keys().next().value;
    if (oldestKey !== undefined) sessionStateById.delete(oldestKey);
  }
  const created: SessionState = {
    sessionId: id,
    currentPlan: null,
    orchestratorPlan: null,
    subAgentCount: 0,
    subAgentProfileCursor: 0,
    lastBrowserAction: null,
    awaitingVerification: false,
    currentStepVerified: false,
    kimiWarningSent: false,
    failureTracker: new Map(),
    reportImages: [],
    reportImageBytes: 0,
    selectedReportImageIds: new Set(),
    tokenVisibility: defaultTokenVisibility(),
    runningSubagents: new Map(),
    subagentHistory: new Map(),
    orchestratorWhiteboard: new Map(),
  };
  sessionStateById.set(id, created);
  return created;
}

export function getBrowserTools(
  browserToolsBySessionId: Map<string, BrowserTools>,
  currentSettings: Record<string, any> | null,
  sessionId: string,
): BrowserTools {
  const id = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default';
  const existing = browserToolsBySessionId.get(id);
  if (existing) return existing;
  // Evict oldest entries when at capacity
  if (browserToolsBySessionId.size >= MAX_SESSIONS) {
    const oldestKey = browserToolsBySessionId.keys().next().value;
    if (oldestKey !== undefined) browserToolsBySessionId.delete(oldestKey);
  }
  const created = new BrowserTools();
  const quality = currentSettings?.screenshotQuality;
  if (quality === 'high' || quality === 'medium' || quality === 'low') {
    created.screenshotQuality = quality;
  }
  browserToolsBySessionId.set(id, created);
  return created;
}
