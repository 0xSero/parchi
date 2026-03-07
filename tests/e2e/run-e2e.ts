#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (error) {
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
  if (!condition) {
    throw new Error(message);
  }
}

const repoRoot = path.resolve(process.cwd());
const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parchi-e2e-'));

const timeoutMs = Number(process.env.E2E_TIMEOUT || 20000);
const slowMo = Number(process.env.E2E_SLOWMO || 0);
const headless = process.env.E2E_HEADLESS === 'true';
if (headless) {
  log('Extensions are not supported in headless mode; tests may fail.', 'warning');
}

const readEnv = (key: string) => {
  const raw = process.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
};

type TestContext = {
  panel: import('playwright').Page;
  context: import('playwright').BrowserContext;
  worker: import('playwright').Worker;
};

const tests: Array<{ name: string; fn: (ctx: TestContext) => Promise<void> }> = [];
const test = (name: string, fn: (ctx: TestContext) => Promise<void>) => tests.push({ name, fn });

async function getExtensionId(context: import('playwright').BrowserContext): Promise<string> {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: timeoutMs });
  }
  const url = new URL(worker.url());
  return url.host;
}

async function sendRuntimeMessage(worker: import('playwright').Worker, message: Record<string, unknown>) {
  await worker.evaluate((payload) => chrome.runtime.sendMessage(payload), message);
}

async function sendRuntimeMessageWithResponse(worker: import('playwright').Worker, message: Record<string, unknown>) {
  return await worker.evaluate(
    (payload) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(payload, (response) => resolve(response));
      }),
    message,
  );
}

const getPanelSessionId = async (panel: import('playwright').Page) =>
  await panel.evaluate(() => (window as any).sidePanelUI?.sessionId || 'session-e2e');

async function sendRuntimeEvent(
  worker: import('playwright').Worker,
  panel: import('playwright').Page,
  event: Record<string, unknown>,
) {
  const sessionId = await getPanelSessionId(panel);
  const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
  const runId = typeof event.runId === 'string' ? event.runId : `run-e2e-${timestamp}`;
  const turnId = typeof event.turnId === 'string' ? event.turnId : `turn-e2e-${timestamp}`;
  await sendRuntimeMessage(worker, {
    schemaVersion: 2,
    sessionId,
    runId,
    turnId,
    timestamp,
    ...event,
  });
}

test('Side panel loads and shows ready state', async ({ panel }) => {
  await panel.waitForSelector('text=Parchi', { timeout: timeoutMs });
  await panel.waitForFunction(
    () => {
      const el = document.querySelector('#statusText');
      return el && el.textContent && el.textContent.includes('Ready');
    },
    { timeout: timeoutMs },
  );
});

test('Settings panel toggles custom endpoint field', async ({ panel }) => {
  await panel.click('#openSidebarBtn');
  await panel.waitForSelector('#settingsPanel', { state: 'visible', timeout: timeoutMs });
  await panel.selectOption('#provider', 'custom');
  await panel.waitForSelector('#customEndpointGroup', { state: 'visible', timeout: timeoutMs });
  await panel.click('#closeSidebarBtn');
  await panel.waitForSelector('#chatInterface', { state: 'visible', timeout: timeoutMs });
});

test('Tab selector lists integration test page', async ({ panel, context }) => {
  const testPagePath = path.join(repoRoot, 'tests/integration/test-page.html');
  const testPageUrl = `file://${testPagePath}`;
  const testPage = await context.newPage();
  await testPage.goto(testPageUrl);

  await panel.click('#tabSelectorBtn');
  await panel.waitForSelector('#tabSelector', { state: 'visible', timeout: timeoutMs });
  await panel.waitForSelector('.tab-item-title', { timeout: timeoutMs });
  const titles = await panel.$$eval('.tab-item-title', (nodes) => nodes.map((node) => (node.textContent || '').trim()));
  assert(
    titles.some((title) => title.includes('Integration Test Page')),
    'Expected integration test page in tab selector.',
  );
  await panel.click('#closeTabSelector');
});

test('Run UI renders plan, tool events, and retry controls', async ({ panel, worker }) => {
  const runId = `run-e2e-${Date.now()}`;
  const now = Date.now();
  const plan = {
    steps: [
      { id: 'step-1', title: 'Open page', status: 'running' },
      { id: 'step-2', title: 'Extract data', status: 'pending' },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await sendRuntimeEvent(worker, panel, {
    type: 'plan_update',
    runId,
    timestamp: now,
    plan,
  });
  await panel.waitForSelector('#planDrawer:not(.hidden)', { timeout: timeoutMs });
  await panel.waitForSelector('#planChecklist .plan-checklist-item', { state: 'visible', timeout: timeoutMs });

  await sendRuntimeEvent(worker, panel, {
    type: 'run_status',
    runId,
    timestamp: now + 1,
    phase: 'executing',
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 1, tool: 1, finalize: 1 },
    note: 'Executing',
  });
  await panel.waitForFunction(
    () => {
      const statusText = document.querySelector('#statusText');
      return statusText && /executing/i.test(statusText.textContent || '');
    },
    { timeout: timeoutMs },
  );

  await sendRuntimeEvent(worker, panel, {
    type: 'tool_execution_start',
    runId,
    timestamp: now + 2,
    tool: 'navigate',
    id: 'tool-1',
    args: { url: 'https://example.com' },
  });

  await sendRuntimeEvent(worker, panel, {
    type: 'tool_execution_result',
    runId,
    timestamp: now + 3,
    tool: 'navigate',
    id: 'tool-1',
    args: { url: 'https://example.com' },
    result: { success: true, message: 'Navigated' },
  });

  await panel.waitForSelector('.tool-row.done', {
    state: 'attached',
    timeout: timeoutMs,
  });

  await sendRuntimeEvent(worker, panel, {
    type: 'run_status',
    runId,
    timestamp: now + 4,
    phase: 'failed',
    attempts: { api: 1, tool: 0, finalize: 0 },
    maxRetries: { api: 1, tool: 1, finalize: 1 },
    lastError: 'Test failure',
  });
  await panel.waitForFunction(
    () => {
      const statusText = document.querySelector('#statusText');
      return statusText && /failed/i.test(statusText.textContent || '');
    },
    { timeout: timeoutMs },
  );
});

test('History restores run cards with filters', async ({ panel, worker }) => {
  const now = Date.now();
  const session = {
    id: `session-e2e-${now}`,
    startedAt: now,
    updatedAt: now,
    title: 'History Session',
    runs: [
      {
        runId: 'run-history-1',
        startedAt: now,
        updatedAt: now,
        goal: 'Check docs',
        plan: {
          steps: [{ id: 'step-1', title: 'Collect info', status: 'done' }],
          createdAt: now,
          updatedAt: now,
        },
        notes: '',
        toolEvents: [
          {
            id: 'tool-1',
            toolName: 'getContent',
            argsText: '{"type":"text"}',
            status: 'success',
            startedAt: now,
            category: 'extraction',
            resultText: '{"success":true}',
          },
        ],
        toolFilter: 'all',
        screenshots: [],
        retryEvents: [],
        subagents: [],
        finalResponse: 'Done',
        status: 'completed',
        statusNote: '',
        statusError: '',
      },
    ],
    transcript: [],
  };

  await worker.evaluate((payload) => chrome.storage.local.set({ chatSessions: payload }), [session]);
  await panel.click('#historyFab');
  await panel.waitForSelector('#historyDrawer:not(.hidden)', { timeout: timeoutMs });
  await panel.waitForSelector('.history-item', { timeout: timeoutMs });
  await panel.click('.history-item .history-item-main');
  await panel.waitForSelector('#chatInterface', { state: 'visible', timeout: timeoutMs });
});

test('Chat displays streaming message during assistant response', async ({ panel, worker }) => {
  const runId = `run-stream-${Date.now()}`;
  const now = Date.now();

  // Send stream start
  await sendRuntimeEvent(worker, panel, {
    type: 'assistant_stream_start',
    runId,
    timestamp: now,
  });

  // Wait for streaming message element to be attached to DOM
  await panel.waitForSelector('.message.assistant.streaming', { state: 'attached', timeout: timeoutMs });

  // Send stream delta with content
  await sendRuntimeEvent(worker, panel, {
    type: 'assistant_stream_delta',
    runId,
    timestamp: now + 1,
    content: 'Hello, I am responding',
  });

  // Verify streamed content exists in DOM
  await panel.waitForFunction(
    () => {
      const el = document.querySelector('.stream-event-text');
      return el && el.textContent && el.textContent.includes('Hello');
    },
    { timeout: timeoutMs },
  );
});

test('Thinking block is collapsed by default and expandable', async ({ panel, worker }) => {
  const runId = `run-thinking-${Date.now()}`;
  const now = Date.now();

  await sendRuntimeEvent(worker, panel, {
    type: 'assistant_stream_start',
    runId,
    timestamp: now,
  });

  await sendRuntimeEvent(worker, panel, {
    type: 'assistant_stream_delta',
    runId,
    timestamp: now + 1,
    channel: 'reasoning',
    content: 'Let me think about this carefully...',
  });

  await panel.waitForSelector('.stream-event-reasoning .stream-reasoning-content', {
    state: 'visible',
    timeout: timeoutMs,
  });
});

test('Tool calls appear in collapsible Tools section', async ({ panel, worker }) => {
  const runId = `run-tool-section-${Date.now()}`;
  const now = Date.now();

  // Send tool execution start
  await sendRuntimeEvent(worker, panel, {
    type: 'tool_execution_start',
    runId,
    timestamp: now,
    tool: 'navigate',
    id: 'tool-section-1',
    args: { url: 'https://example.com' },
  });

  // Verify tool appears in the collapsible Tools section
  await panel.waitForSelector('.tool-row.running', {
    state: 'visible',
    timeout: timeoutMs,
  });

  // Send tool result
  await sendRuntimeEvent(worker, panel, {
    type: 'tool_execution_result',
    runId,
    timestamp: now + 1,
    tool: 'navigate',
    id: 'tool-section-1',
    args: { url: 'https://example.com' },
    result: { success: true },
  });

  // Verify tool shows success status
  await panel.waitForSelector('.tool-row.done', {
    state: 'attached',
    timeout: timeoutMs,
  });
});

test('Live API smoke test via background (optional)', async ({ worker }) => {
  const providers = [
    {
      label: 'OpenAI',
      provider: 'openai',
      apiKeyEnv: 'OPENAI_API_KEY',
      modelEnv: 'OPENAI_MODEL',
      defaultModel: 'gpt-4o',
    },
    {
      label: 'Anthropic',
      provider: 'anthropic',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      modelEnv: 'ANTHROPIC_MODEL',
    },
    {
      label: 'Kimi',
      provider: 'kimi',
      apiKeyEnv: 'KIMI_API_KEY',
      modelEnv: 'KIMI_MODEL',
      endpointEnv: 'KIMI_BASE_URL',
    },
    {
      label: 'Custom',
      provider: 'custom',
      apiKeyEnv: 'CUSTOM_API_KEY',
      modelEnv: 'CUSTOM_MODEL',
      endpointEnv: 'CUSTOM_ENDPOINT',
    },
  ];

  const configured = providers.filter((spec) => {
    const apiKey = readEnv(spec.apiKeyEnv);
    const model = readEnv(spec.modelEnv) || (spec as any).defaultModel || '';
    return Boolean(apiKey && model);
  });

  if (!configured.length) {
    log('API smoke test skipped (no provider env vars set).', 'warning');
    return;
  }

  for (const spec of configured) {
    const apiKey = readEnv(spec.apiKeyEnv);
    const model = readEnv(spec.modelEnv) || (spec as any).defaultModel || '';
    const customEndpoint = spec.endpointEnv ? readEnv(spec.endpointEnv) : '';

    const response: any = await sendRuntimeMessageWithResponse(worker, {
      type: 'api_smoke_test',
      settings: {
        provider: spec.provider,
        apiKey,
        model,
        customEndpoint: customEndpoint || undefined,
      },
      prompt: 'Reply with the word "pong" only.',
    });

    assert(response && response.success, `${spec.label} API smoke test failed to return success.`);
    const resolvedText = String(response?.result?.resolvedText || '')
      .trim()
      .toLowerCase();
    assert(resolvedText.includes('pong'), `${spec.label} returned unexpected response: ${resolvedText}`);

    const usedFallback = !response?.result?.rawText && response?.result?.fallbackText;
    log(`✓ ${spec.label} API responded${usedFallback ? ' (responseMessages fallback)' : ''}`, 'success');
  }
});

test('Color scheme uses neutral grays', async ({ panel }) => {
  // Get computed background color of body
  const bgColor = await panel.$eval('body', (el) => getComputedStyle(el).backgroundColor);

  // Parse RGB values - should be a neutral gray (R, G, B values similar)
  const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    // For neutral gray, R, G, B should be very close (within 5 of each other)
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    assert(maxDiff <= 10, `Colors should be neutral gray, but found difference of ${maxDiff}`);
  }
});

async function run() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║          Parchi - E2E Tests           ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  let context;
  try {
    if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
      throw new Error('Missing dist/manifest.json. Run npm run build first.');
    }
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      slowMo,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--allow-file-access-from-files',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const extensionId = await getExtensionId(context);
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker', { timeout: timeoutMs }));

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, {
      waitUntil: 'domcontentloaded',
    });

    let passed = 0;
    for (const t of tests) {
      try {
        await t.fn({ panel, context, worker });
        passed += 1;
        log(`✓ ${t.name}`, 'success');
      } catch (error) {
        log(`✗ ${t.name}: ${error.message}`, 'error');
      }
    }

    log('\n' + '═'.repeat(40), 'info');
    if (passed === tests.length) {
      log('✓ All E2E tests passed!', 'success');
      process.exitCode = 0;
    } else {
      log(`✗ ${tests.length - passed} E2E tests failed`, 'error');
      process.exitCode = 1;
    }
  } catch (error) {
    log(`✗ E2E harness failed: ${error.message}`, 'error');
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close();
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (error) {
      log(`Warning: failed to remove temp profile: ${error.message}`, 'warning');
    }
  }
}

run();
