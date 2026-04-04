/**
 * Background Service Performance Monitor
 *
 * Tracks memory growth in the service worker context:
 * session state maps and active runs.
 *
 * Access via: chrome.runtime background DevTools console
 *   globalThis.perfMonitor.start() / .stop() / .report()
 */

interface BgSnapshot {
  ts: number;
  elapsed: string;
  sessionCount: number;
  browserToolsCount: number;
  activeRunsCount: number;
  sidepanelLifecyclePorts: number;
}

interface BgPerfReport {
  sessionDuration: string;
  snapshotCount: number;
  current: BgSnapshot;
  peak: { sessions: number; activeRuns: number };
  warnings: string[];
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

class BgPerfMonitor {
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _intervalMs = 60_000; // every 60s for background (less noisy)
  private _startedAt = 0;
  private _snapshots: BgSnapshot[] = [];
  private _maxSnapshots = 1440; // ~24h at 60s
  private _serviceRef: any = null;

  /** Bind to the BackgroundService instance. */
  bind(service: any): void {
    this._serviceRef = service;
  }

  snapshot(): BgSnapshot | null {
    const svc = this._serviceRef;
    if (!svc) {
      console.warn('[perf-bg] No service bound. Call bind(service) first.');
      return null;
    }
    const snap: BgSnapshot = {
      ts: Date.now(),
      elapsed: formatDuration(Date.now() - this._startedAt),
      sessionCount: svc.sessionStateById?.size ?? 0,
      browserToolsCount: svc.browserToolsBySessionId?.size ?? 0,
      activeRunsCount: svc.activeRuns?.size ?? 0,
      sidepanelLifecyclePorts: svc.sidepanelLifecyclePorts?.size ?? 0,
    };
    this._snapshots.push(snap);
    if (this._snapshots.length > this._maxSnapshots) {
      this._snapshots.splice(0, this._snapshots.length - this._maxSnapshots);
    }
    return snap;
  }

  start(intervalMs?: number): void {
    if (this._intervalId) {
      console.warn('[perf-bg] Already running.');
      return;
    }
    this._intervalMs = intervalMs ?? this._intervalMs;
    this._startedAt = Date.now();
    this._snapshots = [];
    console.log(`[perf-bg] Started — snapshotting every ${this._intervalMs / 1000}s`);
    this.snapshot();
    this._intervalId = setInterval(() => {
      const s = this.snapshot();
      if (!s) return;
      const warnings = this._check(s);
      if (warnings.length > 0) {
        console.warn(`[perf-bg] ⚠ ${warnings.join(' | ')}`);
      }
    }, this._intervalMs);
  }

  stop(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      console.log(`[perf-bg] Stopped — ${this._snapshots.length} snapshots`);
    }
  }

  report(): BgPerfReport {
    const current = this.snapshot();
    if (!current)
      return {
        sessionDuration: '0s',
        snapshotCount: 0,
        current: {} as any,
        peak: { sessions: 0, activeRuns: 0 },
        warnings: ['No service bound'],
      };

    const peak = {
      sessions: Math.max(...this._snapshots.map((s) => s.sessionCount)),
      activeRuns: Math.max(...this._snapshots.map((s) => s.activeRunsCount)),
    };

    return {
      sessionDuration: formatDuration(Date.now() - this._startedAt),
      snapshotCount: this._snapshots.length,
      current,
      peak,
      warnings: this._check(current),
    };
  }

  timeline(): void {
    if (this._snapshots.length === 0) {
      console.log('[perf-bg] No snapshots.');
      return;
    }
    console.table(
      this._snapshots.map((s) => ({
        elapsed: s.elapsed,
        sessions: s.sessionCount,
        browserTools: s.browserToolsCount,
        activeRuns: s.activeRunsCount,
        sidepanelLifecyclePorts: s.sidepanelLifecyclePorts,
      })),
    );
  }

  exportJSON(): string {
    return JSON.stringify(this._snapshots, null, 2);
  }

  private _check(s: BgSnapshot): string[] {
    const w: string[] = [];
    if (s.sessionCount > 20) w.push(`${s.sessionCount} sessions in memory (>20)`);
    if (s.browserToolsCount > 20) w.push(`${s.browserToolsCount} browserTools instances (>20)`);
    if (s.activeRunsCount > 3) w.push(`${s.activeRunsCount} active runs (>3)`);
    return w;
  }
}

export const bgPerfMonitor = new BgPerfMonitor();

(globalThis as any).perfMonitor = bgPerfMonitor;
