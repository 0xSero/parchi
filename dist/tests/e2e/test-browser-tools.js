#!/usr/bin/env node

// tests/e2e/test-browser-tools.ts
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
var chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm install");
  process.exit(1);
}
var colors = {
  info: "\x1B[36m",
  success: "\x1B[32m",
  error: "\x1B[31m",
  warning: "\x1B[33m",
  reset: "\x1B[0m"
};
function log(message, type = "info") {
  console.log(`${colors[type]}${message}${colors.reset}`);
}
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
var repoRoot = path.resolve(process.cwd());
var extensionPath = path.join(repoRoot, "dist");
var userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "parchi-tools-test-"));
var timeoutMs = Number(process.env.E2E_TIMEOUT || 3e4);
var headless = process.env.E2E_HEADLESS === "true";
if (headless) {
  log("Warning: headless mode may not support extensions fully", "warning");
}
var tests = [];
var test = (name, fn) => tests.push({ name, fn });
async function getExtensionId(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: timeoutMs });
  }
  const url = new URL(worker.url());
  return url.host;
}
async function executeTool(page, tool, args) {
  const result = await page.evaluate(
    async (payload) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "execute_tool", tool: payload.tool, args: payload.args }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      });
    },
    { tool, args }
  );
  return result;
}
var TEST_PAGE_HTML = `
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

  <script>
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
  </script>
</body>
</html>
`;
test("type() works with text input", async ({ testPage, panel }) => {
  const testText = "Hello World 123";
  const response = await executeTool(panel, "type", {
    selector: "#textInput",
    text: testText
  });
  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);
  const value = await testPage.$eval("#textInput", (el) => el.value);
  assert(value === testText, `Expected "${testText}", got "${value}"`);
  log(`\u2713 Text input type works: "${value}"`, "success");
});
test("type() works with textarea", async ({ testPage, panel }) => {
  const testText = "Line 1\nLine 2\nLine 3";
  const response = await executeTool(panel, "type", {
    selector: "#textareaInput",
    text: testText
  });
  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);
  const value = await testPage.$eval("#textareaInput", (el) => el.value);
  assert(value === testText, `Expected "${testText}", got "${value}"`);
  log("\u2713 Textarea type works", "success");
});
test("type() works with contenteditable div", async ({ testPage, panel }) => {
  const testText = "Contenteditable content";
  const response = await executeTool(panel, "type", {
    selector: "#contenteditableDiv",
    text: testText
  });
  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);
  const textContent = await testPage.$eval("#contenteditableDiv", (el) => el.textContent);
  assert(textContent === testText, `Expected "${testText}", got "${textContent}"`);
  log(`\u2713 Contenteditable div type works: "${textContent}"`, "success");
});
test("type() works with CodeMirror-like wrapper (selector targets wrapper)", async ({ testPage, panel }) => {
  const testText = "CodeMirror content";
  const response = await executeTool(panel, "type", {
    selector: "#cmWrapper",
    text: testText
  });
  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);
  const textContent = await testPage.$eval("#cmEditor", (el) => el.textContent);
  assert(textContent === testText, `Expected "${testText}", got "${textContent}"`);
  log(`\u2713 CodeMirror wrapper type works: "${textContent}"`, "success");
});
test("type() works with nested contenteditable (selector targets wrapper)", async ({ testPage, panel }) => {
  const testText = "Nested content";
  const response = await executeTool(panel, "type", {
    selector: "#nestedWrapper",
    text: testText
  });
  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);
  const textContent = await testPage.$eval("#nestedContent", (el) => el.textContent);
  assert(textContent === testText, `Expected "${testText}", got "${textContent}"`);
  log(`\u2713 Nested contenteditable type works: "${textContent}"`, "success");
});
test("type() works without selector (uses focused element)", async ({ testPage, panel }) => {
  const testText = "Focused typing";
  await testPage.click("#textInput");
  await testPage.waitForTimeout(100);
  const response = await executeTool(panel, "type", {
    text: testText
  });
  const result = response?.result;
  assert(result?.success, `type() should succeed: ${JSON.stringify(result)}`);
  const value = await testPage.$eval("#textInput", (el) => el.value);
  assert(value === testText, `Expected "${testText}", got "${value}"`);
  log(`\u2713 Type without selector works: "${value}"`, "success");
});
test("type() fails gracefully on checkbox", async ({ panel }) => {
  const response = await executeTool(panel, "type", {
    selector: "#testCheckbox",
    text: "test"
  });
  const result = response?.result;
  assert(!result?.success, `type() should fail on checkbox: ${JSON.stringify(result)}`);
  assert(
    result?.error?.includes("checkbox") || result?.error?.includes("click"),
    `Error should mention checkbox/click: ${result?.error}`
  );
  log("\u2713 Type correctly rejects checkbox", "success");
});
async function run() {
  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
  log("\u2551     Browser Tools E2E Tests           \u2551", "info");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
  if (!fs.existsSync(path.join(extensionPath, "manifest.json"))) {
    log("Missing dist/manifest.json. Run npm run build first.", "error");
    process.exit(1);
  }
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/test-page.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(TEST_PAGE_HTML);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => {
    server.listen(0, () => resolve());
  });
  const address = server.address();
  const testPageUrl = `http://127.0.0.1:${address.port}/test-page.html`;
  log(`Test server running at ${testPageUrl}`, "info");
  let context = null;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      // Must be false for extensions
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--allow-file-access-from-files",
        "--disable-dev-shm-usage",
        "--no-sandbox"
      ]
    });
    const extensionId = await getExtensionId(context);
    context.serviceWorkers()[0];
    const testPage = await context.newPage();
    await testPage.goto(testPageUrl, { waitUntil: "domcontentloaded" });
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, {
      waitUntil: "domcontentloaded"
    });
    await panel.waitForSelector("#statusText", { timeout: timeoutMs });
    await new Promise((r) => setTimeout(r, 500));
    log("Configuring session tabs...", "info");
    const configResult = await panel.evaluate(async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const testTab = tabs.find((t) => t.title?.includes("Browser Tools Test Page"));
        if (!testTab) return { success: false, error: "Test page tab not found" };
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "configure_session_tabs_test",
              tabs: [testTab],
              tabId: testTab.id
            },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(response);
              }
            }
          );
        });
      } catch (err) {
        return { success: false, error: String(err) };
      }
    });
    log(`Session tabs config result: ${JSON.stringify(configResult)}`, "info");
    let passed = 0;
    for (const t of tests) {
      try {
        await t.fn({ panel, testPage, context });
        passed += 1;
        log(`\u2713 ${t.name}`, "success");
      } catch (error) {
        log(`\u2717 ${t.name}: ${error.message}`, "error");
      }
    }
    log("\n" + "\u2550".repeat(40), "info");
    if (passed === tests.length) {
      log("\u2713 All browser tools tests passed!", "success");
      process.exitCode = 0;
    } else {
      log(`\u2717 ${tests.length - passed} tests failed`, "error");
      process.exitCode = 1;
    }
  } catch (error) {
    log(`\u2717 Test harness failed: ${error.message}`, "error");
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close();
    }
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
    }
  }
}
run();
//# sourceMappingURL=test-browser-tools.js.map
