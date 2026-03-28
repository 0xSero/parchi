import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { sleep } from '@parchi/shared';
import { buildTabCpuAuditMarkdown } from './tab-cpu-audit-report.js';
import type {
  AggregateRow,
  AuditRow,
  BrowserKind,
  ParsedProcess,
  SampleSummary,
  TabAuditOptions,
} from './tab-cpu-audit-types.js';

const FIREFOX_PARCHI_XPI = '{01750513-9c5b-418a-af8e-31344dd293e3}.xpi';
const ALERT_RATIO = 0.6;

const runCommand = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const sum = <T>(rows: T[], getValue: (row: T) => number) => rows.reduce((acc, row) => acc + getValue(row), 0);
const toFixedNumber = (value: number, digits = 2) => Number(value.toFixed(digits));
const computeSlopePerMinute = (points: Array<{ ts: number; value: number }>) => {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || last.ts <= first.ts) return null;
  const durationMinutes = (last.ts - first.ts) / 60_000;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  return toFixedNumber((last.value - first.value) / durationMinutes);
};

function parseProcessRows(raw: string): ParsedProcess[] {
  const rows: ParsedProcess[] = [];
  const pattern = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\s\S]+?)\s*$/;
  for (const line of raw.split('\n')) {
    const match = pattern.exec(line);
    if (!match) continue;
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      cpuPercent: Number(match[3]),
      rssKb: Number(match[4]),
      elapsed: match[5],
      cpuTime: match[6],
      comm: match[7],
      args: match[8],
    });
  }
  return rows;
}

function inferBrowserKind(row: ParsedProcess): BrowserKind {
  const args = row.args;
  const firefoxTab =
    args.includes('/Firefox.app/Contents/MacOS/plugin-container.app/Contents/MacOS/plugin-container') &&
    /\s\d+\s+tab\s*$/.test(args);
  if (firefoxTab) return 'firefox-tab';
  if (args.includes('/Firefox.app/Contents/MacOS/')) return 'firefox-other';
  const isChrome = args.includes('/Google Chrome.app/') || args.includes('/Chromium.app/');
  if (!isChrome) return 'other';
  return args.includes('--type=renderer') ? 'chrome-renderer' : 'chrome-other';
}

function parseFirefoxProcessNumber(args: string): number | null {
  const match = /\s(\d+)\s+tab\s*$/.exec(args);
  return match ? Number(match[1]) : null;
}

function readOpenXpis(pid: number): string[] {
  try {
    const out = runCommand('lsof', ['-nP', '-p', String(pid), '-Fn']);
    const paths = out
      .split('\n')
      .filter((line) => line.startsWith('n'))
      .map((line) => line.slice(1))
      .filter((name) => name.includes('/extensions/') && name.endsWith('.xpi'))
      .map((name) => path.basename(name));
    return Array.from(new Set(paths)).sort();
  } catch {
    return [];
  }
}

function collectRows(): AuditRow[] {
  const psOutput = runCommand('ps', ['-ax', '-o', 'pid=,ppid=,%cpu=,rss=,etime=,time=,comm=,args=']);
  return parseProcessRows(psOutput).map((row) => {
    const browserKind = inferBrowserKind(row);
    const openXpiNames = browserKind === 'firefox-tab' ? readOpenXpis(row.pid) : [];
    return {
      ...row,
      browserKind,
      firefoxProcNum: parseFirefoxProcessNumber(row.args),
      rssMb: row.rssKb / 1024,
      hasParchiFirefoxXpi: openXpiNames.includes(FIREFOX_PARCHI_XPI),
    };
  });
}

function collectSample(sampleIndex: number, topN: number): SampleSummary {
  const rows = collectRows();
  const topRows = rows
    .slice()
    .sort((a, b) => b.cpuPercent - a.cpuPercent)
    .filter((row) => row.browserKind !== 'other')
    .slice(0, topN);
  const firefoxTabs = rows.filter((row) => row.browserKind === 'firefox-tab');
  const parchiFirefoxTabs = firefoxTabs.filter((row) => row.hasParchiFirefoxXpi);
  const chromeRenderers = rows.filter((row) => row.browserKind === 'chrome-renderer');
  return {
    sampleIndex,
    capturedAt: new Date().toISOString(),
    firefoxTabs: {
      count: firefoxTabs.length,
      totalCpuPercent: toFixedNumber(sum(firefoxTabs, (row) => row.cpuPercent)),
      totalRssMb: toFixedNumber(sum(firefoxTabs, (row) => row.rssMb)),
      tabsWithParchiXpi: firefoxTabs.filter((row) => row.hasParchiFirefoxXpi).length,
    },
    parchiFirefoxTabs: {
      count: parchiFirefoxTabs.length,
      totalCpuPercent: toFixedNumber(sum(parchiFirefoxTabs, (row) => row.cpuPercent)),
      totalRssMb: toFixedNumber(sum(parchiFirefoxTabs, (row) => row.rssMb)),
    },
    chromeRenderers: {
      count: chromeRenderers.length,
      totalCpuPercent: toFixedNumber(sum(chromeRenderers, (row) => row.cpuPercent)),
      totalRssMb: toFixedNumber(sum(chromeRenderers, (row) => row.rssMb)),
    },
    topRows,
  };
}

function aggregate(
  samples: SampleSummary[],
  cpuAlertPercent: number,
  rssAlertMb: number,
): { rows: AggregateRow[]; sustainedAlerts: AggregateRow[]; sustainedMinSamples: number } {
  const byPid = new Map<number, { row: AggregateRow; cpuTotal: number; rssTotal: number }>();
  for (const sample of samples) {
    for (const row of sample.topRows) {
      const existing = byPid.get(row.pid);
      if (!existing) {
        byPid.set(row.pid, {
          row: {
            pid: row.pid,
            browserKind: row.browserKind,
            firefoxProcNum: row.firefoxProcNum,
            hasParchiFirefoxXpi: row.hasParchiFirefoxXpi,
            sampleCount: 1,
            cpuPercentAvg: row.cpuPercent,
            cpuPercentMax: row.cpuPercent,
            rssMbAvg: row.rssMb,
            rssMbMax: row.rssMb,
            highCpuSamples: row.cpuPercent >= cpuAlertPercent ? 1 : 0,
            highRssSamples: row.rssMb >= rssAlertMb ? 1 : 0,
            elapsed: row.elapsed,
            cpuTime: row.cpuTime,
          },
          cpuTotal: row.cpuPercent,
          rssTotal: row.rssMb,
        });
        continue;
      }

      existing.row.sampleCount += 1;
      existing.cpuTotal += row.cpuPercent;
      existing.rssTotal += row.rssMb;
      existing.row.cpuPercentMax = Math.max(existing.row.cpuPercentMax, row.cpuPercent);
      existing.row.rssMbMax = Math.max(existing.row.rssMbMax, row.rssMb);
      existing.row.highCpuSamples += row.cpuPercent >= cpuAlertPercent ? 1 : 0;
      existing.row.highRssSamples += row.rssMb >= rssAlertMb ? 1 : 0;
      existing.row.hasParchiFirefoxXpi ||= row.hasParchiFirefoxXpi;
      existing.row.elapsed = row.elapsed;
      existing.row.cpuTime = row.cpuTime;
    }
  }

  const rows = Array.from(byPid.values())
    .map(({ row, cpuTotal, rssTotal }) => ({
      ...row,
      cpuPercentAvg: cpuTotal / row.sampleCount,
      rssMbAvg: rssTotal / row.sampleCount,
    }))
    .sort((a, b) =>
      b.cpuPercentMax === a.cpuPercentMax ? b.rssMbMax - a.rssMbMax : b.cpuPercentMax - a.cpuPercentMax,
    );

  const sustainedMinSamples = Math.max(2, Math.ceil(samples.length * ALERT_RATIO));
  const sustainedAlerts = rows.filter(
    (row) => row.highCpuSamples >= sustainedMinSamples || row.highRssSamples >= sustainedMinSamples,
  );
  return { rows, sustainedAlerts, sustainedMinSamples };
}

export async function runTabCpuAudit(
  options: TabAuditOptions,
): Promise<{ jsonPath: string; markdownPath: string; sustainedAlertPids: number[] }> {
  const repoRoot = path.resolve(process.cwd());
  const outputDir = path.join(repoRoot, 'test-output', 'perf');
  fs.mkdirSync(outputDir, { recursive: true });

  const startedAt = Date.now();
  const samples: SampleSummary[] = [];
  for (let i = 0; i < options.sampleCount; i += 1) {
    samples.push(collectSample(i + 1, options.topN));
    if (i < options.sampleCount - 1) await sleep(options.sampleIntervalMs);
  }

  const {
    rows: aggregateRows,
    sustainedAlerts,
    sustainedMinSamples,
  } = aggregate(samples, options.cpuAlertPercent, options.rssAlertMb);

  const latest = samples[samples.length - 1];
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  const parchiRssSlopeMbPerMin = computeSlopePerMinute(
    samples.map((sample) => ({
      ts: Date.parse(sample.capturedAt),
      value: sample.parchiFirefoxTabs.totalRssMb,
    })),
  );
  const parchiCpuSlopePercentPerMin = computeSlopePerMinute(
    samples.map((sample) => ({
      ts: Date.parse(sample.capturedAt),
      value: sample.parchiFirefoxTabs.totalCpuPercent,
    })),
  );
  const hottestParchiProcessOverall = aggregateRows.find((row) => row.hasParchiFirefoxXpi) ?? null;
  const result = {
    generatedAt,
    config: {
      topN: options.topN,
      sampleCount: options.sampleCount,
      sampleIntervalMs: options.sampleIntervalMs,
      thresholds: {
        highCpuPercent: options.cpuAlertPercent,
        highRssMb: options.rssAlertMb,
        sustainedMinSamples,
      },
    },
    summary: {
      durationMs: Date.now() - startedAt,
      latestSample: {
        firefoxTabs: latest.firefoxTabs,
        parchiFirefoxTabs: latest.parchiFirefoxTabs,
        chromeRenderers: latest.chromeRenderers,
      },
      sustainedAlertsCount: sustainedAlerts.length,
      hottestProcessOverall: aggregateRows[0] ?? null,
      hottestParchiProcessOverall,
      parchiFirefoxTabs: {
        rssSlopeMbPerMin: parchiRssSlopeMbPerMin,
        cpuSlopePercentPerMin: parchiCpuSlopePercentPerMin,
      },
    },
    samples,
    aggregateTopRows: aggregateRows,
    sustainedAlerts,
  };

  const markdown = buildTabCpuAuditMarkdown({
    generatedAt,
    options,
    sustainedMinSamples,
    latest,
    samples,
    aggregateRows,
    sustainedAlerts,
    parchiRssSlopeMbPerMin,
    parchiCpuSlopePercentPerMin,
  });

  const jsonPath = path.join(outputDir, `tab-cpu-audit-${timestamp}.json`);
  const markdownPath = path.join(outputDir, `tab-cpu-audit-${timestamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  fs.writeFileSync(markdownPath, markdown);
  return { jsonPath, markdownPath, sustainedAlertPids: sustainedAlerts.map((row) => row.pid) };
}
