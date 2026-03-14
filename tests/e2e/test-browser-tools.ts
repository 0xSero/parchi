#!/usr/bin/env node
/**
 * E2E test for browser tools (type, click, navigate, etc.)
 * Tests the type() tool against various input types including contenteditable
 */

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

let chromium: typeof import('playwright').chromium;
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
  if (!condition) {
    throw new Error(message);
  }
}

const repoRoot = path.resolve(process.cwd());
const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parchi-tools-test-'));

const timeoutMs = Number(process.env.E2E_TIMEOUT || 30000);
const headless = process.env.E2E_HEADLESS === 'true';

if (headless) {
  log('Warning: headless mode may not support extensions fully', 'warning');
}

type TestContext = {
  panel: import('playwright').Page;
  testPage: import('playwright').Page;
  context: import('playwright').BrowserContext;
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

async function executeTool(
  page: import('playwright').Page,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await page.evaluate(
    async (payload) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'execute_tool', tool: payload.tool, args: payload.args }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      });
    },
    { tool, args },
  );
  return result;
}

// Test HTML page with various input types
const TEST_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Browser Tools Test Page</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; border-radius: 8px; }
    input, textarea { width: 100%; padding: 8px; margin: 5px 0; box-sizing: border-box; }
    [contenteditable] { 
      min-height: 60px; 
      padding: 8px; 
      border: 1px solid #ccc; 
      border-radius: 4px; 
      background: #fafafa;
    }
    .cm-simulated {
      position: relative;
      border: 1px solid #ccc;
      min-height: 80px;
      background: #fff;
    }
    .cm-simulated .cm-editor {
      padding: 8px;
      outline: none;
    }
    .cm-simulated .hidden-textarea {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
    }
    .result { margin-top: 10px; padding: 8px; background: #e8f5e9; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Browser Tools Test Page</h1>
  
  <div class="section">
    <h3>Text Input</h3>
    <input type="text" id="textInput" placeholder="Type here...">
    <div id="textInputResult" class="result" style="display:none">Typed: <span></span></div>
  </div>
  
  <div class="section">
    <h3>Checkbox</h3>
    <label><input type="checkbox" id="testCheckbox"> Test checkbox</label>
  </div>
  
  <div class="section">
    <h3>Textarea</h3>
    <textarea id="textareaInput" placeholder="Type here..." rows="3"></textarea>
    <div id="textareaResult" class="result" style="display:none">Typed: <span></span></div>
  </div>
  
  <div class="section">
    <h3>Contenteditable Div</h3>
    <div id="contenteditableDiv" contenteditable="true" class="editable">Click to edit...</div>
    <div id="contenteditableResult" class="result" style="display:none">Typed: <span></span></div>
  </div>
  
  <div class="section">
    <h3>CodeMirror-like Wrapper</h3>
    <div class="cm-simulated" id="cmWrapper">
      <div class="cm-editor" contenteditable="true" id="cmEditor">Start typing...</div>
      <textarea class="hidden-textarea" id="cmHiddenTextarea"></textarea>
    </div>
    <div id="cmResult" class="result" style="display:none">Typed: <span></span></div>
  </div>
  
  <div class="section">
    <h3>Nested Contenteditable</h3>
    <div id="nestedWrapper" class="cm-simulated">
      <div class="editor-content" contenteditable="true" id="nestedContent">Nested editable...</div>
    </div>
  </div>

  <div class="section">
    <h3>Page State</h3>
    <button id="fetchDataBtn" type="button">Fetch data</button>
    <div id="fetchResult" class="result" style="display:none"></div>
  </div>

  <script>
    window.testAppState = {
      user: { name: 'Parchi' },
      counts: { sections: document.querySelectorAll('.section').length }
    };

    // Track input changes for verification
    document.getElementById('textInput').addEventListener('input', (e) => {
      const result = document.getElementById('textInputResult');
      result.querySelector('span').textContent = e.target.value;
      result.style.display = 'block';
    });
    
    document.getElementById('textareaInput').addEventListener('input', (e) => {
      const result = document.getElementById('textareaResult');
      result.querySelector('span').textContent = e.target.value;
      result.style.display = 'block';
    });
    
    document.getElementById('contenteditableDiv').addEventListener('input', (e) => {
      const result = document.getElementById('contenteditableResult');
      result.querySelector('span').textContent = e.target.textContent;
      result.style.display = 'block';
    });
    
    document.getElementById('cmEditor').addEventListener('input', (e) => {
      const result = document.getElementById('cmResult');
      result.querySelector('span').textContent = e.target.textContent;
      document.getElementById('cmHiddenTextarea').value = e.target.textContent;
      result.style.display = 'block';
    });

    document.getElementById('fetchDataBtn').addEventListener('click', async () => {
      const response = await fetch('/api/data?source=test-browser-tools');
      const payload = await response.json();
      const result = document.getElementById('fetchResult');
      result.textContent = JSON.stringify(payload);
      result.style.display = 'block';
    });
  </script>
</body>
</html>
`;

test('type() works with text input', async ({ testPage, panel }) => {
  const testText = 'Hello World 123';

  // Clear and type
  const response = (await executeTool(panel, 'type', {
    selector: '#textInput',
    text: testText,
  })) as any;

  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);

  // Verify the value was set
  const value = await testPage.$eval('#textInput', (el) => (el as HTMLInputElement).value);
  assert(value === testText, `Expected "${testText}", got "${value}"`);

  log(`✓ Text input type works: "${value}"`, 'success');
});

test('type() works with textarea', async ({ testPage, panel }) => {
  const testText = 'Line 1\nLine 2\nLine 3';

  const response = (await executeTool(panel, 'type', {
    selector: '#textareaInput',
    text: testText,
  })) as any;

  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);

  const value = await testPage.$eval('#textareaInput', (el) => (el as HTMLTextAreaElement).value);
  assert(value === testText, `Expected "${testText}", got "${value}"`);

  log('✓ Textarea type works', 'success');
});

test('type() works with contenteditable div', async ({ testPage, panel }) => {
  const testText = 'Contenteditable content';

  const response = (await executeTool(panel, 'type', {
    selector: '#contenteditableDiv',
    text: testText,
  })) as any;

  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);

  const textContent = await testPage.$eval('#contenteditableDiv', (el) => el.textContent);
  assert(textContent === testText, `Expected "${testText}", got "${textContent}"`);

  log(`✓ Contenteditable div type works: "${textContent}"`, 'success');
});

test('type() works with CodeMirror-like wrapper (selector targets wrapper)', async ({ testPage, panel }) => {
  const testText = 'CodeMirror content';

  // When selector points at the wrapper, it should find the contenteditable child
  const response = (await executeTool(panel, 'type', {
    selector: '#cmWrapper',
    text: testText,
  })) as any;

  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);

  const textContent = await testPage.$eval('#cmEditor', (el) => el.textContent);
  assert(textContent === testText, `Expected "${testText}", got "${textContent}"`);

  log(`✓ CodeMirror wrapper type works: "${textContent}"`, 'success');
});

test('type() works with nested contenteditable (selector targets wrapper)', async ({ testPage, panel }) => {
  const testText = 'Nested content';

  const response = (await executeTool(panel, 'type', {
    selector: '#nestedWrapper',
    text: testText,
  })) as any;

  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);

  const textContent = await testPage.$eval('#nestedContent', (el) => el.textContent);
  assert(textContent === testText, `Expected "${testText}", got "${textContent}"`);

  log(`✓ Nested contenteditable type works: "${textContent}"`, 'success');
});

test('type() works without selector (uses focused element)', async ({ testPage, panel }) => {
  const testText = 'Focused typing';

  // First click to focus
  await testPage.click('#textInput');
  await testPage.waitForTimeout(100);

  // Type without selector - should use active element
  const response = (await executeTool(panel, 'type', {
    text: testText,
  })) as any;

  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);

  const value = await testPage.$eval('#textInput', (el) => (el as HTMLInputElement).value);
  assert(value === testText, `Expected "${testText}", got "${value}"`);

  log(`✓ Type without selector works: "${value}"`, 'success');
});

test('type() fails gracefully on checkbox', async ({ panel }) => {
  const response = (await executeTool(panel, 'type', {
    selector: '#testCheckbox',
    text: 'test',
  })) as any;

  // The response is {success: true, result: {...}} where result is the tool result
  const result = response?.result;

  // Should fail with helpful error
  assert(!result?.success, `type() should fail on checkbox: ${JSON.stringify(result)}`);
  assert(
    result?.error?.includes('checkbox') || result?.error?.includes('click'),
    `Error should mention checkbox/click: ${result?.error}`,
  );

  log('✓ Type correctly rejects checkbox', 'success');
});

test('evaluate() reads page JavaScript state', async ({ panel }) => {
  const response = (await executeTool(panel, 'evaluate', {
    script: 'return window.testAppState.user.name;',
  })) as any;

  const result = response?.result;
  assert(result?.success, `evaluate() should succeed: ${JSON.stringify(result)}`);
  assert(result?.result === 'Parchi', `Expected page state value "Parchi", got ${JSON.stringify(result)}`);

  log('✓ evaluate() reads page JavaScript state', 'success');
});

test('watchNetwork() + getNetworkLog() capture fetch responses', async ({ panel, testPage }) => {
  const watchResponse = (await executeTool(panel, 'watchNetwork', {
    clearExisting: true,
  })) as any;

  const watchResult = watchResponse?.result;
  assert(watchResult?.success, `watchNetwork() should succeed: ${JSON.stringify(watchResult)}`);

  await testPage.click('#fetchDataBtn');
  await testPage.waitForSelector('#fetchResult', { state: 'visible', timeout: timeoutMs });

  const logResponse = (await executeTool(panel, 'getNetworkLog', {
    urlIncludes: '/api/data',
    includeBody: true,
    limit: 10,
  })) as any;

  const logResult = logResponse?.result;
  assert(logResult?.success, `getNetworkLog() should succeed: ${JSON.stringify(logResult)}`);
  assert(Array.isArray(logResult?.entries) && logResult.entries.length > 0, 'Expected captured network entries.');

  const match = logResult.entries.find((entry: any) => String(entry.url || '').includes('/api/data'));
  assert(match, `Expected /api/data entry in network log: ${JSON.stringify(logResult.entries)}`);
  assert(
    String(match.body || '').includes('hello-network'),
    `Expected response body to include hello-network, got ${JSON.stringify(match)}`,
  );

  log('✓ watchNetwork() + getNetworkLog() capture fetch responses', 'success');
});

async function run() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║     Browser Tools E2E Tests           ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    log('Missing dist/manifest.json. Run npm run build first.', 'error');
    process.exit(1);
  }

  // Start a simple HTTP server for the test page
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/test-page.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(TEST_PAGE_HTML);
    } else if (req.url?.startsWith('/api/data')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'hello-network', ok: true }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as { port: number };
  const testPageUrl = `http://127.0.0.1:${address.port}/test-page.html`;
  log(`Test server running at ${testPageUrl}`, 'info');

  let context: import('playwright').BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Must be false for extensions
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--allow-file-access-from-files',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const extensionId = await getExtensionId(context);
    context.serviceWorkers()[0]; // Ensure service worker is ready

    // Open test page from local HTTP server
    const testPage = await context.newPage();
    await testPage.goto(testPageUrl, { waitUntil: 'domcontentloaded' });

    // Open side panel
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for extension to be ready
    await panel.waitForSelector('#statusText', { timeout: timeoutMs });

    // Give the background service a moment to fully initialize
    await new Promise((r) => setTimeout(r, 500));

    // Find the test page tab ID and configure session tabs from the panel context
    log('Configuring session tabs...', 'info');
    const configResult = await panel.evaluate(async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const testTab = tabs.find((t) => t.title?.includes('Browser Tools Test Page'));
        if (!testTab) return { success: false, error: 'Test page tab not found' };

        // Configure via background
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'configure_session_tabs_test',
              tabs: [testTab],
              tabId: testTab.id,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(response);
              }
            },
          );
        });
      } catch (err) {
        return { success: false, error: String(err) };
      }
    });
    log(`Session tabs config result: ${JSON.stringify(configResult)}`, 'info');

    let passed = 0;
    for (const t of tests) {
      try {
        await t.fn({ panel, testPage, context });
        passed += 1;
        log(`✓ ${t.name}`, 'success');
      } catch (error: any) {
        log(`✗ ${t.name}: ${error.message}`, 'error');
      }
    }

    log('\n' + '═'.repeat(40), 'info');
    if (passed === tests.length) {
      log('✓ All browser tools tests passed!', 'success');
      process.exitCode = 0;
    } else {
      log(`✗ ${tests.length - passed} tests failed`, 'error');
      process.exitCode = 1;
    }
  } catch (error: any) {
    log(`✗ Test harness failed: ${error.message}`, 'error');
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close();
    }
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

run();
