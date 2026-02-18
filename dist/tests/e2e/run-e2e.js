#!/usr/bin/env node

// tests/e2e/run-e2e.ts
import fs from "fs";
import os from "os";
import path from "path";
var chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
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
var userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "parchi-e2e-"));
var timeoutMs = Number(process.env.E2E_TIMEOUT || 2e4);
var slowMo = Number(process.env.E2E_SLOWMO || 0);
var headless = process.env.E2E_HEADLESS === "true";
if (headless) {
  log("Extensions are not supported in headless mode; tests may fail.", "warning");
}
var readEnv = (key) => {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
};
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
async function sendRuntimeMessage(worker, message) {
  await worker.evaluate((payload) => chrome.runtime.sendMessage(payload), message);
}
async function sendRuntimeMessageWithResponse(worker, message) {
  return await worker.evaluate(
    (payload) => new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response) => resolve(response));
    }),
    message
  );
}
test("Side panel loads and shows ready state", async ({ panel }) => {
  await panel.waitForSelector("text=Parchi", { timeout: timeoutMs });
  await panel.waitForFunction(
    () => {
      const el = document.querySelector("#statusText");
      return el && el.textContent && el.textContent.includes("Ready");
    },
    { timeout: timeoutMs }
  );
});
test("Settings panel toggles custom endpoint field", async ({ panel }) => {
  await panel.click("#settingsBtn");
  await panel.waitForSelector("#settingsPanel", { state: "visible", timeout: timeoutMs });
  await panel.selectOption("#provider", "custom");
  await panel.waitForSelector("#customEndpointGroup", { state: "visible", timeout: timeoutMs });
  await panel.click("#settingsBtn");
  await panel.waitForSelector("#chatInterface", { state: "visible", timeout: timeoutMs });
});
test("Tab selector lists integration test page", async ({ panel, context }) => {
  const testPagePath = path.join(repoRoot, "tests/integration/test-page.html");
  const testPageUrl = `file://${testPagePath}`;
  const testPage = await context.newPage();
  await testPage.goto(testPageUrl);
  await panel.click("#tabSelectorBtn");
  await panel.waitForSelector("#tabSelector", { state: "visible", timeout: timeoutMs });
  await panel.waitForSelector(".tab-item-title", { timeout: timeoutMs });
  const titles = await panel.$$eval(".tab-item-title", (nodes) => nodes.map((node) => (node.textContent || "").trim()));
  assert(
    titles.some((title) => title.includes("Integration Test Page")),
    "Expected integration test page in tab selector."
  );
});
test("Run UI renders plan, tool events, and retry controls", async ({ panel, worker }) => {
  const runId = `run-e2e-${Date.now()}`;
  const now = Date.now();
  const plan = {
    steps: [
      { id: "step-1", title: "Open page", status: "running" },
      { id: "step-2", title: "Extract data", status: "pending" }
    ],
    createdAt: now,
    updatedAt: now
  };
  await sendRuntimeMessage(worker, {
    type: "plan_update",
    schemaVersion: 1,
    runId,
    timestamp: now,
    plan
  });
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"]`, { timeout: timeoutMs });
  await panel.click(`.run-container[data-run-id="${runId}"] .run-plan-toggle`);
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"] .run-plan-step`, {
    state: "visible",
    timeout: timeoutMs
  });
  await sendRuntimeMessage(worker, {
    type: "run_status",
    schemaVersion: 1,
    runId,
    timestamp: now + 1,
    phase: "executing",
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 1, tool: 1, finalize: 1 },
    note: "Executing"
  });
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"] .run-status-stop`, {
    state: "visible",
    timeout: timeoutMs
  });
  await sendRuntimeMessage(worker, {
    type: "tool_execution_start",
    schemaVersion: 1,
    runId,
    timestamp: now + 2,
    tool: "navigate",
    id: "tool-1",
    args: { url: "https://example.com" }
  });
  await sendRuntimeMessage(worker, {
    type: "tool_execution_result",
    schemaVersion: 1,
    runId,
    timestamp: now + 3,
    tool: "navigate",
    id: "tool-1",
    args: { url: "https://example.com" },
    result: { success: true, message: "Navigated" }
  });
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"] details.tool-event.success`, {
    state: "attached",
    timeout: timeoutMs
  });
  await sendRuntimeMessage(worker, {
    type: "run_status",
    schemaVersion: 1,
    runId,
    timestamp: now + 4,
    phase: "failed",
    attempts: { api: 1, tool: 0, finalize: 0 },
    maxRetries: { api: 1, tool: 1, finalize: 1 },
    lastError: "Test failure"
  });
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"] .run-status-retry`, {
    state: "visible",
    timeout: timeoutMs
  });
});
test("History restores run cards with filters", async ({ panel, worker }) => {
  const now = Date.now();
  const session = {
    id: `session-e2e-${now}`,
    startedAt: now,
    updatedAt: now,
    title: "History Session",
    runs: [
      {
        runId: "run-history-1",
        startedAt: now,
        updatedAt: now,
        goal: "Check docs",
        plan: {
          steps: [{ id: "step-1", title: "Collect info", status: "done" }],
          createdAt: now,
          updatedAt: now
        },
        notes: "",
        toolEvents: [
          {
            id: "tool-1",
            toolName: "getContent",
            argsText: '{"type":"text"}',
            status: "success",
            startedAt: now,
            category: "extraction",
            resultText: '{"success":true}'
          }
        ],
        toolFilter: "all",
        screenshots: [],
        retryEvents: [],
        subagents: [],
        finalResponse: "Done",
        status: "completed",
        statusNote: "",
        statusError: ""
      }
    ],
    transcript: []
  };
  await worker.evaluate((payload) => chrome.storage.local.set({ chatSessions: payload }), [session]);
  await panel.click("#viewHistoryBtn");
  await panel.waitForSelector(".history-item", { timeout: timeoutMs });
  await panel.click(".history-item");
  await panel.waitForSelector(".history-runs .run-tool-filters", { timeout: timeoutMs });
});
test("Chat displays streaming message during assistant response", async ({ panel, worker }) => {
  const runId = `run-stream-${Date.now()}`;
  const now = Date.now();
  await sendRuntimeMessage(worker, {
    type: "assistant_stream_start",
    schemaVersion: 1,
    runId,
    timestamp: now
  });
  await panel.waitForSelector(".message.assistant.streaming", { state: "attached", timeout: timeoutMs });
  await sendRuntimeMessage(worker, {
    type: "assistant_stream_delta",
    schemaVersion: 1,
    runId,
    timestamp: now + 1,
    content: "Hello, I am responding"
  });
  await panel.waitForFunction(
    () => {
      const el = document.querySelector(".streaming-text");
      return el && el.textContent && el.textContent.includes("Hello");
    },
    { timeout: timeoutMs }
  );
});
test("Thinking block is collapsed by default and expandable", async ({ panel, worker }) => {
  const runId = `run-thinking-${Date.now()}`;
  const now = Date.now();
  await sendRuntimeMessage(worker, {
    type: "assistant_final",
    schemaVersion: 1,
    runId,
    timestamp: now,
    content: "Here is my response.",
    thinking: "Let me think about this carefully..."
  });
  const runSelector = `.run-container[data-run-id="${runId}"]`;
  await panel.waitForFunction(
    (selector) => {
      const run2 = document.querySelector(selector);
      if (!run2) return false;
      const details = run2.querySelector(".run-thinking-details:not(.hidden)");
      return details && !details.open;
    },
    runSelector,
    { timeout: timeoutMs }
  );
  await panel.evaluate((selector) => {
    const run2 = document.querySelector(selector);
    const summary = run2?.querySelector(".run-thinking-summary");
    summary?.click();
  }, runSelector);
  await panel.waitForFunction(
    (selector) => {
      const run2 = document.querySelector(selector);
      if (!run2) return false;
      const details = run2.querySelector(".run-thinking-details");
      return details && details.open;
    },
    runSelector,
    { timeout: timeoutMs }
  );
});
test("Tool calls appear in collapsible Tools section", async ({ panel, worker }) => {
  const runId = `run-tool-section-${Date.now()}`;
  const now = Date.now();
  await sendRuntimeMessage(worker, {
    type: "tool_execution_start",
    schemaVersion: 1,
    runId,
    timestamp: now,
    tool: "navigate",
    id: "tool-section-1",
    args: { url: "https://example.com" }
  });
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"] .run-tools-details`, {
    state: "attached",
    timeout: timeoutMs
  });
  await panel.waitForFunction(
    (selector) => {
      const run2 = document.querySelector(selector);
      if (!run2) return false;
      const toolsSection = run2.querySelector(".run-tools-details");
      return toolsSection && !toolsSection.classList.contains("hidden");
    },
    `.run-container[data-run-id="${runId}"]`,
    { timeout: timeoutMs }
  );
  const toolCount = await panel.$eval(
    `.run-container[data-run-id="${runId}"] .run-tools-count`,
    (el) => el.textContent
  );
  assert(toolCount === "1", "Tool count should be 1");
  await sendRuntimeMessage(worker, {
    type: "tool_execution_result",
    schemaVersion: 1,
    runId,
    timestamp: now + 1,
    tool: "navigate",
    id: "tool-section-1",
    args: { url: "https://example.com" },
    result: { success: true }
  });
  await panel.waitForSelector(`.run-container[data-run-id="${runId}"] details.tool-event.success`, {
    state: "attached",
    timeout: timeoutMs
  });
});
test("Live API smoke test via background (optional)", async ({ worker }) => {
  const providers = [
    {
      label: "OpenAI",
      provider: "openai",
      apiKeyEnv: "OPENAI_API_KEY",
      modelEnv: "OPENAI_MODEL",
      defaultModel: "gpt-4o"
    },
    {
      label: "Anthropic",
      provider: "anthropic",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      modelEnv: "ANTHROPIC_MODEL"
    },
    {
      label: "Kimi",
      provider: "kimi",
      apiKeyEnv: "KIMI_API_KEY",
      modelEnv: "KIMI_MODEL",
      endpointEnv: "KIMI_BASE_URL"
    },
    {
      label: "Custom",
      provider: "custom",
      apiKeyEnv: "CUSTOM_API_KEY",
      modelEnv: "CUSTOM_MODEL",
      endpointEnv: "CUSTOM_ENDPOINT"
    }
  ];
  const configured = providers.filter((spec) => {
    const apiKey = readEnv(spec.apiKeyEnv);
    const model = readEnv(spec.modelEnv) || spec.defaultModel || "";
    return Boolean(apiKey && model);
  });
  if (!configured.length) {
    log("API smoke test skipped (no provider env vars set).", "warning");
    return;
  }
  for (const spec of configured) {
    const apiKey = readEnv(spec.apiKeyEnv);
    const model = readEnv(spec.modelEnv) || spec.defaultModel || "";
    const customEndpoint = spec.endpointEnv ? readEnv(spec.endpointEnv) : "";
    const response = await sendRuntimeMessageWithResponse(worker, {
      type: "api_smoke_test",
      settings: {
        provider: spec.provider,
        apiKey,
        model,
        customEndpoint: customEndpoint || void 0
      },
      prompt: 'Reply with the word "pong" only.'
    });
    assert(response && response.success, `${spec.label} API smoke test failed to return success.`);
    const resolvedText = String(response?.result?.resolvedText || "").trim().toLowerCase();
    assert(resolvedText.includes("pong"), `${spec.label} returned unexpected response: ${resolvedText}`);
    const usedFallback = !response?.result?.rawText && response?.result?.fallbackText;
    log(`\u2713 ${spec.label} API responded${usedFallback ? " (responseMessages fallback)" : ""}`, "success");
  }
});
test("Color scheme uses neutral grays", async ({ panel }) => {
  const bgColor = await panel.$eval("body", (el) => getComputedStyle(el).backgroundColor);
  const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    assert(maxDiff <= 10, `Colors should be neutral gray, but found difference of ${maxDiff}`);
  }
});
async function run() {
  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
  log("\u2551          Parchi - E2E Tests           \u2551", "info");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
  let context;
  try {
    if (!fs.existsSync(path.join(extensionPath, "manifest.json"))) {
      throw new Error("Missing dist/manifest.json. Run npm run build first.");
    }
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      slowMo,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--allow-file-access-from-files",
        "--disable-dev-shm-usage",
        "--no-sandbox"
      ]
    });
    const extensionId = await getExtensionId(context);
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: timeoutMs });
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`, {
      waitUntil: "domcontentloaded"
    });
    let passed = 0;
    for (const t of tests) {
      try {
        await t.fn({ panel, context, worker });
        passed += 1;
        log(`\u2713 ${t.name}`, "success");
      } catch (error) {
        log(`\u2717 ${t.name}: ${error.message}`, "error");
      }
    }
    log("\n" + "\u2550".repeat(40), "info");
    if (passed === tests.length) {
      log("\u2713 All E2E tests passed!", "success");
      process.exitCode = 0;
    } else {
      log(`\u2717 ${tests.length - passed} E2E tests failed`, "error");
      process.exitCode = 1;
    }
  } catch (error) {
    log(`\u2717 E2E harness failed: ${error.message}`, "error");
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.close();
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (error) {
      log(`Warning: failed to remove temp profile: ${error.message}`, "warning");
    }
  }
}
run();
//# sourceMappingURL=run-e2e.js.map
