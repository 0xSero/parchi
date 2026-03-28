#!/usr/bin/env node
/**
 * Performance Profiling Test
 *
 * Launches Chrome with the extension, configures OpenRouter, sends real messages,
 * and collects performance data (memory, DOM, data structure growth) over time.
 *
 * Usage:
 *   PERF_DEBUG=true npm run build && node dist/tests/perf/run-perf-profile.js
 *
 * Environment:
 *   OPENROUTER_API_KEY — required (reads from .env if present)
 *   PERF_ROUNDS=5       — number of conversation rounds (default 5)
 *   PERF_DELAY=3000     — ms to wait between rounds (default 3000)
 *   E2E_SLOWMO=0        — Playwright slowMo
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

let chromium: typeof import('playwright').chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright not installed. Run: npm install');
  process.exit(1);
}

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
} as const;

function log(msg: string, type: keyof typeof colors = 'info') {
  console.log(`${colors[type]}${msg}${colors.reset}`);
}

// ── Config ──────────────────────────────────────────────────────────

const repoRoot = path.resolve(process.cwd());
const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parchi-perf-'));

const ROUNDS = Number(process.env.PERF_ROUNDS || 5);
const DELAY_MS = Number(process.env.PERF_DELAY || 3000);
const RESPONSE_TIMEOUT = 60_000;
const slowMo = Number(process.env.E2E_SLOWMO || 0);

const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
if (!openRouterKey) {
  console.error('OPENROUTER_API_KEY not set. Provide it or ensure .env is loaded.');
  process.exit(1);
}

// ── Prompts for generating load ─────────────────────────────────────

const prompts = [
  'What is the capital of France? Answer in one sentence.',
  'Write a short haiku about the ocean.',
  'List 3 prime numbers greater than 100.',
  'Explain what a closure is in JavaScript in 2 sentences.',
  'What year did the first iPhone come out? One line answer.',
  'Name 5 colors of the rainbow.',
  'What is 42 * 17? Just the number.',
  'Write a one-line Python function that reverses a string.',
  'What is the speed of light in km/s? Short answer.',
  'Name the 4 largest planets in our solar system.',
];

// ── Helpers ─────────────────────────────────────────────────────────

type PerfSnapshot = {
  round: number;
  label: string;
  ts: number;
  elapsed: string;
  memory: { jsHeapUsedMB: number; jsHeapTotalMB: number } | null;
  dom: { totalNodes: number; chatChildCount: number };
  data: Record<string, number> | null;
  timers: Record<string, boolean> | null;
  cssAnimations: number;
};

async function collectSnapshot(
  panel: import('playwright').Page,
  round: number,
  label: string,
  startTime: number,
): Promise<PerfSnapshot> {
  return panel.evaluate(
    ({ round, label, startTime }) => {
      const perf = performance as any;
      const mem = perf.memory
        ? {
            jsHeapUsedMB: +(perf.memory.usedJSHeapSize / 1048576).toFixed(2),
            jsHeapTotalMB: +(perf.memory.totalJSHeapSize / 1048576).toFixed(2),
          }
        : null;

      const chatEl = document.querySelector('#chatMessages') || document.querySelector('.chat-messages');
      const dom = {
        totalNodes: document.querySelectorAll('*').length,
        chatChildCount: chatEl ? chatEl.childElementCount : 0,
      };

      const ui = (window as any).sidePanelUI;
      let data: Record<string, number> | null = null;
      let timers: Record<string, boolean> | null = null;

      if (ui) {
        let imgKB = 0;
        if (ui.reportImages instanceof Map) {
          for (const [, img] of ui.reportImages) imgKB += (img?.dataUrl?.length ?? 0) / 1024;
        }
        data = {
          displayHistory: ui.displayHistory?.length ?? 0,
          contextHistory: ui.contextHistory?.length ?? 0,
          reportImages: ui.reportImages?.size ?? 0,
          reportImagesKB: +imgKB.toFixed(1),
          toolCallViews: ui.toolCallViews?.size ?? 0,
          historyTurnMap: ui.historyTurnMap?.size ?? 0,
          scrollPositions: ui.scrollPositions?.size ?? 0,
          subagents: ui.subagents?.size ?? 0,
          stepTimelineSteps: ui.stepTimeline?.steps?.size ?? 0,
        };
        timers = {
          thinkingTimer: ui.thinkingTimerId != null,
          runTimer: ui.runTimerId != null,
          watchdog: ui._watchdogTimerId != null,
          typingCheck: ui._typingCheckTimerId != null,
          recording: ui.recordingState?.timerId != null,
        };
      }

      const elapsed = (() => {
        const s = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(s / 60);
        return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
      })();

      let cssAnimations = 0;
      try {
        cssAnimations = document.getAnimations?.().length ?? 0;
      } catch {
        // document.getAnimations not supported in this browser
      }

      return { round, label, ts: Date.now(), elapsed, memory: mem, dom, data, timers, cssAnimations };
    },
    { round, label, startTime },
  );
}

async function getExtensionId(context: import('playwright').BrowserContext): Promise<string> {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  }
  return new URL(worker.url()).host;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────────

async function run() {
  log('╔════════════════════════════════════════════════╗');
  log('║     Parchi — Performance Profiling Test        ║');
  log('╚════════════════════════════════════════════════╝');
  log(`Rounds: ${ROUNDS} | Delay: ${DELAY_MS}ms | Model: openrouter`);

  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    log('Missing dist/manifest.json — run: PERF_DEBUG=true npm run build', 'error');
    process.exit(1);
  }

  const snapshots: PerfSnapshot[] = [];
  let context: import('playwright').BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      slowMo,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--allow-file-access-from-files',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        // Enable performance.memory for heap measurements
        '--enable-precise-memory-info',
      ],
    });

    const extensionId = await getExtensionId(context);
    log(`Extension ID: ${extensionId}`, 'dim');

    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker', { timeout: 30_000 }));

    // ── Pre-configure OpenRouter via storage ────────────────────────
    log('Configuring OpenRouter profile...', 'info');
    await worker.evaluate(
      ({ key }) => {
        return chrome.storage.local.set({
          configs: {
            default: {
              provider: 'openrouter',
              apiKey: key,
              model: 'openai/gpt-4.1-nano',
              customEndpoint: 'https://openrouter.ai/api/v1',
              systemPrompt: 'You are a helpful assistant. Keep answers short.',
              temperature: 0.7,
              maxTokens: 256,
              contextLimit: 200000,
              timeout: 30000,
              streamResponses: true,
              showThinking: false,
              autoScroll: true,
              confirmActions: false,
              saveHistory: true,
              enableScreenshots: false,
              sendScreenshotsAsImages: false,
            },
          },
          activeConfig: 'default',
        });
      },
      { key: openRouterKey },
    );

    // ── Open sidepanel ──────────────────────────────────────────────
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for UI to initialize
    await panel.waitForFunction(
      () => {
        const el = document.querySelector('#statusText');
        return el && el.textContent && (el.textContent.includes('Ready') || el.textContent.includes('ready'));
      },
      { timeout: 30_000 },
    );
    log('Sidepanel ready ✓', 'success');

    const startTime = Date.now();

    // ── Baseline snapshot ───────────────────────────────────────────
    snapshots.push(await collectSnapshot(panel, 0, 'baseline', startTime));
    log('Baseline snapshot captured', 'dim');

    // ── Send messages ───────────────────────────────────────────────
    for (let i = 0; i < ROUNDS; i++) {
      const prompt = prompts[i % prompts.length];
      log(`\nRound ${i + 1}/${ROUNDS}: "${prompt}"`, 'info');

      // Snapshot before sending
      snapshots.push(await collectSnapshot(panel, i + 1, `pre-send-${i + 1}`, startTime));

      // Type and send message
      const userInput = await panel.$('#userInput');
      if (!userInput) {
        log('Could not find #userInput', 'error');
        break;
      }
      await userInput.fill(prompt);
      await panel.click('#sendBtn');

      // Wait for the composer to first enter "running" state, then exit it
      try {
        // First wait for it to start running (message was sent)
        await panel.waitForFunction(
          () => {
            const composer = document.querySelector('#composer');
            return composer && composer.classList.contains('running');
          },
          { timeout: 10_000, polling: 200 },
        );
        // Now wait for it to finish
        await panel.waitForFunction(
          () => {
            const composer = document.querySelector('#composer');
            return composer && !composer.classList.contains('running');
          },
          { timeout: RESPONSE_TIMEOUT, polling: 500 },
        );
        log('  Response received ✓', 'success');
      } catch {
        log(`  Response timed out after ${RESPONSE_TIMEOUT / 1000}s`, 'warning');
        // If still running, try to stop it
        const stillRunning = await panel
          .$eval('#composer', (el) => el.classList.contains('running'))
          .catch(() => false);
        if (stillRunning) {
          log('  Clicking stop to recover...', 'dim');
          await panel.click('#sendBtn').catch(() => {});
          await sleep(2000);
        }
      }

      // Snapshot after response
      snapshots.push(await collectSnapshot(panel, i + 1, `post-response-${i + 1}`, startTime));

      // Small delay between rounds
      if (i < ROUNDS - 1) {
        await sleep(DELAY_MS);
      }
    }

    // ── Final snapshot after cooldown ───────────────────────────────
    log('\nCooldown (5s)...', 'dim');
    await sleep(5000);
    snapshots.push(await collectSnapshot(panel, ROUNDS + 1, 'final-cooldown', startTime));

    // ── Also grab the perf monitor's data if it was auto-started ────
    const monitorData = await panel.evaluate(() => {
      const pm = (window as any).perfMonitor;
      if (pm && typeof pm.exportJSON === 'function') {
        return pm.exportJSON();
      }
      return null;
    });

    // ── Report ──────────────────────────────────────────────────────
    log('\n' + '═'.repeat(60), 'bold');
    log('  PERFORMANCE PROFILE RESULTS', 'bold');
    log('═'.repeat(60), 'bold');

    const baseline = snapshots[0];
    const final = snapshots[snapshots.length - 1];

    log('\n── Memory ──', 'info');
    if (baseline.memory && final.memory) {
      log(
        `  Heap: ${baseline.memory.jsHeapUsedMB}MB → ${final.memory.jsHeapUsedMB}MB (Δ ${(final.memory.jsHeapUsedMB - baseline.memory.jsHeapUsedMB).toFixed(2)}MB)`,
        final.memory.jsHeapUsedMB - baseline.memory.jsHeapUsedMB > 20 ? 'warning' : 'success',
      );
      log(`  Heap total: ${final.memory.jsHeapTotalMB}MB`, 'dim');
    } else {
      log('  performance.memory not available (need --enable-precise-memory-info)', 'warning');
    }

    log('\n── DOM ──', 'info');
    log(
      `  Total nodes: ${baseline.dom.totalNodes} → ${final.dom.totalNodes} (Δ ${final.dom.totalNodes - baseline.dom.totalNodes})`,
      final.dom.totalNodes - baseline.dom.totalNodes > 500 ? 'warning' : 'success',
    );
    log(
      `  Chat children: ${baseline.dom.chatChildCount} → ${final.dom.chatChildCount} (Δ ${final.dom.chatChildCount - baseline.dom.chatChildCount})`,
      'info',
    );

    log('\n── Data Structures ──', 'info');
    if (baseline.data && final.data) {
      for (const key of Object.keys(final.data)) {
        const bv = baseline.data[key] ?? 0;
        const fv = final.data[key] ?? 0;
        const delta = fv - bv;
        const tag = delta > 0 ? `+${delta}` : `${delta}`;
        log(`  ${key}: ${bv} → ${fv} (${tag})`, delta > 0 ? 'warning' : 'dim');
      }
    }

    log('\n── Timers at Rest ──', 'info');
    if (final.timers) {
      const leakedTimers = Object.entries(final.timers).filter(([, active]) => active);
      if (leakedTimers.length === 0) {
        log('  All timers stopped ✓', 'success');
      } else {
        for (const [name] of leakedTimers) {
          log(`  ⚠ ${name} still active after cooldown`, 'warning');
        }
      }
    }

    log('\n── CSS Animations ──', 'info');
    log(`  Running: ${final.cssAnimations}`, final.cssAnimations > 5 ? 'warning' : 'dim');

    // ── Timeline table ──────────────────────────────────────────────
    log('\n── Snapshot Timeline ──', 'info');
    console.table(
      snapshots.map((s) => ({
        label: s.label,
        elapsed: s.elapsed,
        heapMB: s.memory?.jsHeapUsedMB ?? '-',
        domNodes: s.dom.totalNodes,
        chatChildren: s.dom.chatChildCount,
        messages: s.data?.displayHistory ?? '-',
        toolViews: s.data?.toolCallViews ?? '-',
        animations: s.cssAnimations,
      })),
    );

    // ── Save to file ────────────────────────────────────────────────
    const outDir = path.join(repoRoot, 'tests', 'perf');
    const outFile = path.join(outDir, `perf-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
    fs.mkdirSync(outDir, { recursive: true });
    const output = {
      meta: {
        rounds: ROUNDS,
        delay: DELAY_MS,
        model: 'openai/gpt-4.1-nano',
        startTime,
        endTime: Date.now(),
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      },
      snapshots,
      monitorData: monitorData ? JSON.parse(monitorData) : null,
    };
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
    log(`\nResults saved to: ${outFile}`, 'success');

    log('\n' + '═'.repeat(60), 'bold');
  } catch (error: any) {
    log(`\nFatal error: ${error.message}`, 'error');
    if (error.stack) log(error.stack, 'dim');
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close();
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

run();
