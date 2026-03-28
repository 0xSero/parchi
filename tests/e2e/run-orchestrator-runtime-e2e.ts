#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { registerOrchestratorE2ETests } from './orchestrator-e2e-test.js';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm install');
  process.exit(1);
}

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m',
} as const;

function log(message: string, type: keyof typeof colors = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const repoRoot = path.resolve(process.cwd());
const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parchi-orchestrator-e2e-'));
const timeoutMs = Number(process.env.E2E_TIMEOUT || 30000);

type TestContext = {
  panel: import('playwright').Page;
};

const tests: Array<{ name: string; fn: (ctx: TestContext) => Promise<void> }> = [];
const test = (name: string, fn: (ctx: TestContext) => Promise<void>) => tests.push({ name, fn });

async function getExtensionId(context: import('playwright').BrowserContext): Promise<string> {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: timeoutMs });
  }
  return new URL(worker.url()).host;
}

async function sendRuntimeMessageWithResponse(panel: import('playwright').Page, message: Record<string, unknown>) {
  return await panel.evaluate(
    (payload) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(payload, (response) => {
          resolve({
            response,
            lastError: chrome.runtime.lastError?.message || null,
          });
        });
      }),
    message,
  );
}

registerOrchestratorE2ETests({
  test,
  assert,
  repoRoot,
  sendRuntimeMessageWithResponse: async (worker, message) => {
    const wrapped: any = await sendRuntimeMessageWithResponse(worker, message);
    if (wrapped?.lastError) {
      return { success: false, error: wrapped.lastError };
    }
    return wrapped?.response;
  },
});

let context: import('playwright').BrowserContext | null = null;
try {
  log('╔════════════════════════════════════════════════════╗', 'info');
  log('║   Parchi - Orchestrator Runtime E2E Workflow      ║', 'info');
  log('╚════════════════════════════════════════════════════╝', 'info');

  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('Missing dist/manifest.json. Run npm run build first.');
  }

  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--allow-file-access-from-files',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  const activeContext = context!;
  const extensionId = await getExtensionId(activeContext);
  activeContext.serviceWorkers()[0] || (await activeContext.waitForEvent('serviceworker', { timeout: timeoutMs }));
  const panel = await activeContext.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, { waitUntil: 'domcontentloaded' });

  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn({ panel });
      passed += 1;
      log(`✓ ${t.name}`, 'success');
    } catch (error) {
      log(`✗ ${t.name}: ${(error as Error).message}`, 'error');
    }
  }

  if (passed !== tests.length) {
    process.exitCode = 1;
    log(`✗ ${tests.length - passed} orchestrator E2E test(s) failed`, 'error');
  } else {
    process.exitCode = 0;
    log('✓ Orchestrator runtime E2E workflow passed!', 'success');
  }
} catch (error) {
  process.exitCode = 1;
  log(`✗ Orchestrator E2E harness failed: ${(error as Error).message}`, 'error');
} finally {
  if (context) await context.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`Failed to clean up temp dir ${userDataDir}:`, err);
  }
}
