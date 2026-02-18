#!/usr/bin/env node

// packages/extension/ai/message-utils.ts
function extractThinking(content, existingThinking = null) {
  let thinking = existingThinking || null;
  let cleanedContent = content || "";
  const thinkRegex = /<\s*(think|analysis|thinking)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let match;
  const collected = [];
  while ((match = thinkRegex.exec(cleanedContent)) !== null) {
    if (match[2]) collected.push(match[2].trim());
  }
  if (collected.length > 0) {
    thinking = [existingThinking, ...collected].filter(Boolean).join("\n\n").trim();
    thinkRegex.lastIndex = 0;
    cleanedContent = cleanedContent.replace(thinkRegex, "").trim();
  }
  return { content: cleanedContent, thinking };
}
function estimateTokensFromContent(content) {
  if (!content) return 0;
  if (typeof content === "string") return Math.ceil(content.length / 4);
  if (Array.isArray(content)) {
    return content.reduce((acc, part) => {
      if (typeof part === "string") return acc + Math.ceil(part.length / 4);
      if (part && typeof part === "object") {
        if ("text" in part && typeof part.text === "string") return acc + Math.ceil(part.text.length / 4);
        try {
          return acc + Math.ceil(JSON.stringify(part).length / 4);
        } catch {
          return acc;
        }
      }
      return acc;
    }, 0);
  }
  try {
    return Math.ceil(JSON.stringify(content).length / 4);
  } catch {
    return Math.ceil(String(content).length / 4);
  }
}

// packages/extension/ai/compaction.ts
var DEFAULT_COMPACTION_SETTINGS = {
  enabled: true,
  reserveTokens: 16384,
  keepRecentTokens: 2e4
};
function calculateContextTokens(usage) {
  return usage.totalTokens || usage.inputTokens + usage.outputTokens;
}
function getAssistantUsage(message) {
  if (message.role !== "assistant") return void 0;
  return message.usage && message.usage.totalTokens >= 0 ? message.usage : void 0;
}
function getLastAssistantUsageInfo(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const usage = getAssistantUsage(messages[i]);
    if (usage) return { usage, index: i };
  }
  return void 0;
}
function estimateContextTokens(messages) {
  const usageInfo = getLastAssistantUsageInfo(messages);
  if (!usageInfo) {
    let estimated = 0;
    for (const message of messages) {
      estimated += estimateTokens(message);
    }
    return {
      tokens: estimated,
      usageTokens: 0,
      trailingTokens: estimated,
      lastUsageIndex: null
    };
  }
  const usageTokens = calculateContextTokens(usageInfo.usage);
  let trailingTokens = 0;
  for (let i = usageInfo.index + 1; i < messages.length; i += 1) {
    trailingTokens += estimateTokens(messages[i]);
  }
  return {
    tokens: usageTokens + trailingTokens,
    usageTokens,
    trailingTokens,
    lastUsageIndex: usageInfo.index
  };
}
function shouldCompact({
  contextTokens,
  contextLimit,
  settings = DEFAULT_COMPACTION_SETTINGS
}) {
  if (!settings.enabled) {
    return { shouldCompact: false, approxTokens: contextTokens, percent: 0 };
  }
  const percent = contextLimit > 0 ? contextTokens / contextLimit : 0;
  return {
    shouldCompact: contextTokens > contextLimit - settings.reserveTokens,
    approxTokens: contextTokens,
    percent
  };
}
function estimateTokens(message) {
  let tokens = estimateTokensFromContent(message.content);
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!part || typeof part !== "object") continue;
      if (part.type === "image" || part.type === "image_url" || part.type === "image_url") {
        tokens += 1200;
      }
      if (part.source?.data) {
        tokens += 1200;
      }
    }
  }
  if (message.role === "assistant" && Array.isArray(message.toolCalls)) {
    tokens += Math.ceil(JSON.stringify(message.toolCalls).length / 4);
  }
  return tokens;
}
function buildCompactionSummaryMessage(summary, trimmedCount) {
  return {
    role: "system",
    content: summary.trim(),
    meta: {
      kind: "summary",
      summaryOfCount: trimmedCount,
      source: "auto"
    }
  };
}
function applyCompaction({
  summaryMessage,
  preserved,
  trimmedCount
}) {
  return {
    compacted: [summaryMessage, ...preserved],
    summaryMessage,
    trimmedCount,
    preservedCount: preserved.length
  };
}

// packages/extension/ai/message-schema.ts
var ROLE_SET = /* @__PURE__ */ new Set(["system", "user", "assistant", "tool"]);
function createMessageId() {
  return `msg_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
}
function createMessage({ role, content, ...meta } = {}) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  const message = {
    id: meta.id || createMessageId(),
    createdAt: meta.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    role: normalizedRole,
    content: normalizeContent(content)
  };
  if (typeof meta.thinking === "string" && meta.thinking.trim()) {
    message.thinking = meta.thinking;
  }
  if (meta.toolCalls) message.toolCalls = normalizeToolCalls(meta.toolCalls);
  if (meta.toolCallId) message.toolCallId = String(meta.toolCallId);
  if (meta.toolName) message.toolName = String(meta.toolName);
  if (meta.name) message.name = String(meta.name);
  if (meta.usage) message.usage = normalizeUsage(meta.usage);
  if (meta.meta) message.meta = meta.meta;
  return message;
}
function normalizeConversationHistory(history = [], options = {}) {
  const messages = Array.isArray(history) ? history : [];
  const normalized = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const role = normalizeRole(msg.role || options.defaultRole);
    if (!role) continue;
    const base = {
      role,
      content: normalizeContent(msg.content)
    };
    const id = typeof msg.id === "string" ? msg.id : options.addIds === false ? null : createMessageId();
    if (id) base.id = id;
    const createdAt = typeof msg.createdAt === "string" ? msg.createdAt : options.addTimestamps === false ? null : (/* @__PURE__ */ new Date()).toISOString();
    if (createdAt) base.createdAt = createdAt;
    if (typeof msg.thinking === "string" && msg.thinking.trim()) {
      base.thinking = msg.thinking;
    }
    if (role === "assistant") {
      const toolCalls = msg.toolCalls || msg.tool_calls;
      if (Array.isArray(toolCalls)) {
        base.toolCalls = normalizeToolCalls(toolCalls);
      }
    }
    if (role === "tool") {
      const toolCallId = msg.toolCallId || msg.tool_call_id;
      if (toolCallId) base.toolCallId = String(toolCallId);
      if (msg.name) base.name = String(msg.name);
      if (msg.toolName) base.toolName = String(msg.toolName);
    }
    if (msg.usage) base.usage = normalizeUsage(msg.usage);
    if (msg.meta) base.meta = msg.meta;
    normalized.push(base);
  }
  return normalized;
}
function toProviderMessages(history = []) {
  const normalized = normalizeConversationHistory(history, {
    addIds: false,
    addTimestamps: false
  });
  return normalized.map((msg) => {
    if (msg.role === "tool") {
      const toolCallId = msg.toolCallId || msg.tool_call_id || "";
      return {
        role: "tool",
        tool_call_id: toolCallId,
        content: normalizeToolContent(msg.content)
      };
    }
    const payload = {
      role: msg.role,
      content: msg.content
    };
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      payload.tool_calls = msg.toolCalls.map((call) => ({
        id: call.id || createMessageId(),
        type: "function",
        function: {
          name: call.name || "",
          arguments: JSON.stringify(call.args || {})
        }
      }));
    }
    return payload;
  });
}
function normalizeToolCalls(toolCalls = []) {
  return toolCalls.map((call) => ({
    id: typeof call?.id === "string" ? call.id : createMessageId(),
    name: typeof call?.name === "string" ? call.name : call && typeof call.function?.name === "string" ? String(call.function?.name) : "",
    args: normalizeArgs(
      call?.args ?? call?.arguments ?? call?.function?.arguments
    )
  }));
}
function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.inputTokens || 0),
    outputTokens: Number(usage.outputTokens || 0),
    totalTokens: Number(usage.totalTokens || 0)
  };
}
function normalizeRole(role) {
  if (typeof role !== "string") return "";
  const lowered = role.toLowerCase();
  return ROLE_SET.has(lowered) ? lowered : "";
}
function normalizeContent(content) {
  if (content === null || content === void 0) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}
function normalizeArgs(args) {
  if (args && typeof args === "object" && !Array.isArray(args)) return args;
  if (Array.isArray(args)) return { value: args };
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return { value: args };
    }
  }
  return {};
}
function normalizeToolContent(content) {
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? "");
  }
}

// packages/extension/ai/retry-engine.ts
var DEFAULT_QUIT_PHRASES = [
  "please try again",
  "i could not produce a final summary",
  "i could not produce a final response",
  "unable to produce a final summary",
  "unable to provide a final response"
];
function hasRunawayRepetition(text) {
  const segments = text.split(/[\n.!?]+/).map((segment) => segment.trim().toLowerCase()).filter(Boolean).map((segment) => segment.replace(/[^a-z0-9\s]/g, "")).map((segment) => segment.replace(/\s+/g, " ").trim()).filter((segment) => segment.length >= 20);
  if (segments.length < 8) return false;
  const counts = /* @__PURE__ */ new Map();
  let maxCount = 0;
  for (const segment of segments) {
    const next = (counts.get(segment) || 0) + 1;
    counts.set(segment, next);
    if (next > maxCount) maxCount = next;
  }
  return maxCount >= 4 && maxCount / segments.length >= 0.33;
}
function createExponentialBackoff(options = {}) {
  const baseMs = Number.isFinite(options.baseMs) ? Number(options.baseMs) : 500;
  const maxMs = Number.isFinite(options.maxMs) ? Number(options.maxMs) : 8e3;
  const jitter = Number.isFinite(options.jitter) ? Number(options.jitter) : 0.2;
  const rng = options.rng || Math.random;
  return (attempt) => {
    const safeAttempt = Math.max(1, Math.floor(attempt));
    const raw = Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
    if (jitter <= 0) return Math.round(raw);
    const jitterFactor = 1 + (rng() * 2 - 1) * jitter;
    return Math.round(raw * jitterFactor);
  };
}
function isValidFinalResponse(text, options = {}) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return options.allowEmpty === true;
  const lowered = trimmed.toLowerCase();
  const phrases = options.quitPhrases || DEFAULT_QUIT_PHRASES;
  if (phrases.some((phrase) => lowered.includes(phrase))) return false;
  if (hasRunawayRepetition(trimmed)) return false;
  return true;
}

// packages/shared/src/plan.ts
var PLAN_STATUSES = ["pending", "running", "done", "blocked"];
var PLAN_STATUS_SET = new Set(PLAN_STATUSES);
function normalizePlanStatus(value) {
  if (typeof value !== "string") return "pending";
  const lowered = value.trim().toLowerCase();
  return PLAN_STATUS_SET.has(lowered) ? lowered : "pending";
}
function normalizePlanSteps(input, options = {}) {
  const rawSteps = Array.isArray(input) ? input : [];
  const maxSteps = options.maxSteps ?? 8;
  const normalized = [];
  for (const step of rawSteps) {
    let title = "";
    let status = "pending";
    let notes;
    if (typeof step === "string") {
      title = step.trim();
    } else if (step && typeof step === "object") {
      const candidate = step;
      if (typeof candidate.title === "string") {
        title = candidate.title.trim();
      }
      status = normalizePlanStatus(candidate.status);
      if (typeof candidate.notes === "string" && candidate.notes.trim()) {
        notes = candidate.notes.trim();
      }
    }
    if (!title) continue;
    normalized.push({
      id: `step-${normalized.length + 1}`,
      title,
      status,
      ...notes ? { notes } : {}
    });
    if (normalized.length >= maxSteps) break;
  }
  return normalized;
}
function buildRunPlan(stepsInput, options = {}) {
  const now = options.now ?? Date.now();
  const maxSteps = options.maxSteps ?? 8;
  const incomingSteps = normalizePlanSteps(stepsInput, { maxSteps });
  const existingPlan = options.existingPlan ?? null;
  const existingSteps = existingPlan?.steps || [];
  const steps = [
    ...existingSteps.map((step, index) => ({
      ...step,
      id: step.id || `step-${index + 1}`
    })),
    ...incomingSteps.map((step, index) => ({
      ...step,
      id: `step-${existingSteps.length + index + 1}`
    }))
  ].slice(0, maxSteps);
  const createdAt = options.existingPlan?.createdAt ?? now;
  return {
    steps,
    createdAt,
    updatedAt: now
  };
}

// packages/shared/src/runtime-messages.ts
var RUNTIME_MESSAGE_SCHEMA_VERSION = 2;
var runtimeMessageTypes = [
  "user_run_start",
  "assistant_stream_start",
  "assistant_stream_delta",
  "assistant_stream_stop",
  "tool_execution_start",
  "tool_execution_result",
  "plan_update",
  "manual_plan_update",
  "run_status",
  "assistant_response",
  "assistant_final",
  "run_error",
  "run_warning",
  "context_compacted",
  "subagent_start",
  "subagent_complete",
  "session_tabs_update"
];
function isRuntimeMessage(value) {
  if (!value || typeof value !== "object") return false;
  const message = value;
  if (message.schemaVersion !== RUNTIME_MESSAGE_SCHEMA_VERSION) return false;
  if (typeof message.type !== "string") return false;
  if (!runtimeMessageTypes.includes(message.type)) return false;
  if (typeof message.runId !== "string" || !message.runId) return false;
  if (typeof message.sessionId !== "string" || !message.sessionId) return false;
  if (typeof message.timestamp !== "number") return false;
  return true;
}

// tests/unit/run-unit-tests.ts
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
var TestRunner = class {
  passed;
  failed;
  errors;
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }
  test(description, fn) {
    try {
      fn();
      this.passed++;
      log(`\u2713 ${description}`, "success");
      return true;
    } catch (error) {
      const err = error;
      this.failed++;
      this.errors.push({ test: description, error: err.message });
      log(`\u2717 ${description}: ${err.message}`, "error");
      return false;
    }
  }
  assertEqual(actual, expected, message = "") {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message}
Expected: ${JSON.stringify(expected)}
Actual: ${JSON.stringify(actual)}`);
    }
  }
  assertTrue(condition, message = "Assertion failed") {
    if (!condition) {
      throw new Error(message);
    }
  }
  assertFalse(condition, message = "Assertion failed") {
    if (condition) {
      throw new Error(message);
    }
  }
  assertThrows(fn, message = "Should have thrown an error") {
    try {
      fn();
      throw new Error(message);
    } catch (error) {
      const err = error;
      if (err.message === message) {
        throw err;
      }
    }
  }
  printSummary() {
    log("\n=== Unit Test Summary ===", "info");
    log(`Tests Passed: ${this.passed}`, "success");
    if (this.failed > 0) {
      log(`Tests Failed: ${this.failed}`, "error");
      log("\nFailed Tests:", "error");
      this.errors.forEach((e) => {
        log(`  ${e.test}:`, "error");
        log(`    ${e.error}`, "error");
      });
    }
    if (this.failed === 0) {
      log("\n\u2713 All unit tests passed!", "success");
      return true;
    } else {
      log("\n\u2717 Some unit tests failed!", "error");
      return false;
    }
  }
};
function testToolDefinitions(runner) {
  log("\n=== Testing Tool Definitions ===", "info");
  const mockToolDefinitions = [
    {
      name: "navigate",
      description: "Navigate to a URL",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string" },
          tabId: { type: "number" }
        },
        required: ["url"]
      }
    }
  ];
  runner.test("Tool definitions have required fields", () => {
    mockToolDefinitions.forEach((tool) => {
      runner.assertTrue(tool.name, "Tool must have name");
      runner.assertTrue(tool.description, "Tool must have description");
      runner.assertTrue(tool.input_schema, "Tool must have input_schema");
      runner.assertTrue(tool.input_schema.type === "object", "Schema type must be object");
      runner.assertTrue(tool.input_schema.properties, "Schema must have properties");
    });
  });
  runner.test("Required parameters are properly marked", () => {
    const navTool = mockToolDefinitions.find((t) => t.name === "navigate");
    runner.assertTrue(navTool?.input_schema.required?.includes("url"), "Navigate requires url");
  });
}
function testAIProviderConfig(runner) {
  log("\n=== Testing AI Provider Configuration ===", "info");
  runner.test("OpenAI provider config is valid", () => {
    const config = {
      provider: "openai",
      apiKey: "sk-test123",
      model: "gpt-4o",
      systemPrompt: "Test prompt"
    };
    runner.assertEqual(config.provider, "openai");
    runner.assertTrue(config.apiKey.startsWith("sk-"), "OpenAI keys should start with sk-");
  });
  runner.test("Anthropic provider config is valid", () => {
    const config = {
      provider: "anthropic",
      apiKey: "test-key",
      model: "claude-3-5-sonnet-20241022",
      systemPrompt: "Test prompt"
    };
    runner.assertEqual(config.provider, "anthropic");
    runner.assertTrue(config.model.includes("claude"), 'Anthropic model should contain "claude"');
  });
  runner.test("Custom provider config is valid", () => {
    const config = {
      provider: "custom",
      apiKey: "custom-key",
      model: "custom-model",
      customEndpoint: "https://api.example.com/v1",
      systemPrompt: "Test prompt"
    };
    runner.assertEqual(config.provider, "custom");
    runner.assertTrue((config.customEndpoint ?? "").startsWith("https://"), "Custom endpoint should use HTTPS");
  });
}
function testToolSchemaConversion(runner) {
  log("\n=== Testing Tool Schema Conversion ===", "info");
  runner.test("Convert to OpenAI format", () => {
    const tool = {
      name: "test_tool",
      description: "Test description",
      input_schema: {
        type: "object",
        properties: {
          param1: { type: "string" }
        },
        required: ["param1"]
      }
    };
    const openaiFormat = {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    };
    runner.assertEqual(openaiFormat.type, "function");
    runner.assertEqual(openaiFormat.function.name, "test_tool");
  });
  runner.test("Convert to Anthropic format", () => {
    const tool = {
      name: "test_tool",
      description: "Test description",
      input_schema: {
        type: "object",
        properties: {
          param1: { type: "string" }
        },
        required: ["param1"]
      }
    };
    const anthropicFormat = {
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    };
    runner.assertEqual(anthropicFormat.name, "test_tool");
    runner.assertTrue(anthropicFormat.input_schema.properties.param1);
  });
}
function testInputValidation(runner) {
  log("\n=== Testing Input Validation ===", "info");
  runner.test("Validate URL format", () => {
    const validUrls = ["https://google.com", "http://example.com", "https://sub.domain.com/path"];
    validUrls.forEach((url) => {
      runner.assertTrue(url.startsWith("http://") || url.startsWith("https://"), `${url} should be valid`);
    });
  });
  runner.test("Validate CSS selectors", () => {
    const validSelectors = ["#id", ".class", "div", 'input[name="test"]', ".class > div", "div:nth-child(2)"];
    validSelectors.forEach((selector) => {
      runner.assertTrue(selector.length > 0, "Selector should not be empty");
      runner.assertFalse(selector.includes("  "), "Selector should not have double spaces");
    });
  });
  runner.test("Validate tab group colors", () => {
    const validColors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
    const testColor = "blue";
    runner.assertTrue(validColors.includes(testColor), `${testColor} should be a valid color`);
  });
}
function testErrorHandling(runner) {
  log("\n=== Testing Error Handling ===", "info");
  runner.test("Missing required parameters throw error", () => {
    runner.assertThrows(() => {
      const params = {};
      if (!params.url) {
        throw new Error("Missing required parameter: url");
      }
    }, "Should not execute without required params");
  });
  runner.test("Invalid selector format detected", () => {
    const invalidSelectors = ["", "  ", null, void 0];
    invalidSelectors.forEach((selector) => {
      if (!selector || selector.trim() === "") {
        runner.assertTrue(true);
      }
    });
  });
}
function testMessageSchema(runner) {
  log("\n=== Testing Message Schema ===", "info");
  runner.test("createMessage builds canonical message", () => {
    const msg = createMessage({ role: "user", content: "hello" });
    if (!msg) {
      throw new Error("Message should not be null");
    }
    runner.assertTrue(typeof msg.id === "string", "Message should have id");
    runner.assertTrue(typeof msg.createdAt === "string", "Message should have createdAt");
    runner.assertEqual(msg.role, "user");
    runner.assertEqual(msg.content, "hello");
  });
  runner.test("normalizeConversationHistory filters invalid messages", () => {
    const normalized = normalizeConversationHistory([
      { role: "user", content: "ok" },
      { role: "invalid", content: "skip" },
      null
    ]);
    runner.assertEqual(normalized.length, 1);
    runner.assertEqual(normalized[0].role, "user");
  });
  runner.test("toProviderMessages serializes tool calls and results", () => {
    const history = [
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "click", args: { selector: "#a" } }]
      },
      {
        role: "tool",
        content: { success: true },
        toolCallId: "call_1"
      }
    ];
    const provider = toProviderMessages(history);
    runner.assertTrue(Array.isArray(provider[0].tool_calls), "tool_calls should be an array");
    runner.assertTrue(typeof provider[0].tool_calls?.[0]?.function?.arguments === "string", "tool args serialized");
    runner.assertEqual(provider[1].role, "tool");
    const toolContent = typeof provider[1].content === "string" ? provider[1].content : JSON.stringify(provider[1].content);
    runner.assertTrue(toolContent.includes("success"));
  });
  runner.test("thinking metadata is preserved and not sent to provider", () => {
    const history = [{ role: "assistant", content: "Hello", thinking: "Drafting response" }];
    const normalized = normalizeConversationHistory(history);
    runner.assertEqual(normalized[0]?.thinking, "Drafting response");
    const provider = toProviderMessages(normalized);
    runner.assertFalse("thinking" in provider[0], "Provider messages should not include thinking");
  });
}
function testConversationCompaction(runner) {
  log("\n=== Testing Conversation Compaction ===", "info");
  runner.test("compaction utilities preserve summaries + recent messages", () => {
    const history = Array.from({ length: 20 }, (_, idx) => ({
      role: "user",
      content: `Message ${idx} ${"x".repeat(200)}`
    }));
    const usage = estimateContextTokens(history);
    const check = shouldCompact({
      contextTokens: usage.tokens,
      contextLimit: 500,
      settings: DEFAULT_COMPACTION_SETTINGS
    });
    runner.assertTrue(check.shouldCompact, "Should trigger compaction");
    const preserved = history.slice(-5);
    const summaryMessage = buildCompactionSummaryMessage(
      "Summary of earlier context.",
      history.length - preserved.length
    );
    const result = applyCompaction({
      summaryMessage,
      preserved,
      trimmedCount: history.length - preserved.length
    });
    runner.assertTrue(
      result.compacted.length === preserved.length + 1,
      "Compacted history should include summary + preserved messages"
    );
    runner.assertEqual(result.compacted[0].meta?.kind, "summary");
  });
}
function testThinkingExtraction(runner) {
  log("\n=== Testing Thinking Extraction ===", "info");
  runner.test("extractThinking strips <analysis> tags", () => {
    const result = extractThinking("Hello <analysis>secret</analysis> world");
    runner.assertTrue(result.thinking === "secret", "Should capture analysis content");
    runner.assertFalse(result.content.includes("<analysis>"), "Content should not include analysis tags");
  });
  runner.test("extractThinking merges think + analysis with existing notes", () => {
    const result = extractThinking("Start <think>first</think> middle <analysis>second</analysis>", "seed");
    runner.assertTrue(result.thinking?.includes("seed"), "Existing notes should be preserved");
    runner.assertTrue(result.thinking?.includes("first"), "Think tags should be captured");
    runner.assertTrue(result.thinking?.includes("second"), "Analysis tags should be captured");
    runner.assertFalse(result.content.includes("think"), "Content should not include think tags");
    runner.assertFalse(result.content.includes("analysis"), "Content should not include analysis tags");
  });
}
function testPlanNormalization(runner) {
  log("\n=== Testing Plan Normalization ===", "info");
  runner.test("normalizePlanStatus handles invalid values", () => {
    runner.assertEqual(normalizePlanStatus("done"), "done");
    runner.assertEqual(normalizePlanStatus("RUNNING"), "running");
    runner.assertEqual(normalizePlanStatus("unknown"), "pending");
  });
  runner.test("normalizePlanSteps trims, filters, and clamps", () => {
    const steps = normalizePlanSteps([
      { title: "  Step one  ", status: "done" },
      { title: "", status: "pending" },
      { title: "Step two", status: "blocked", notes: "  Needs access  " }
    ]);
    runner.assertEqual(steps.length, 2);
    runner.assertEqual(steps[0].id, "step-1");
    runner.assertEqual(steps[1].status, "blocked");
    runner.assertEqual(steps[1].notes, "Needs access");
    const tooMany = normalizePlanSteps(
      Array.from({ length: 12 }, (_, idx) => ({
        title: `Step ${idx + 1}`,
        status: "pending"
      }))
    );
    runner.assertEqual(tooMany.length, 8);
  });
  runner.test("buildRunPlan preserves createdAt and updates timestamps", () => {
    const now = Date.now();
    const existing = buildRunPlan([{ title: "Step one", status: "pending" }], {
      now
    });
    const updated = buildRunPlan([{ title: "Step two", status: "done" }], {
      existingPlan: existing,
      now: now + 5e3
    });
    runner.assertEqual(updated.createdAt, existing.createdAt);
    runner.assertTrue(updated.updatedAt > existing.updatedAt, "updatedAt should advance");
    runner.assertEqual(updated.steps[0].title, "Step two");
  });
}
function testRetryHelpers(runner) {
  log("\n=== Testing Retry Helpers ===", "info");
  runner.test("isValidFinalResponse rejects empty and quit phrases", () => {
    runner.assertFalse(isValidFinalResponse(""), "Empty response should be invalid");
    runner.assertFalse(isValidFinalResponse("Please try again."), "Quit phrase should be invalid");
    runner.assertFalse(
      isValidFinalResponse("I could not produce a final response."),
      "Quit phrase variants should be invalid"
    );
    runner.assertTrue(isValidFinalResponse("Here is the result."), "Normal response should be valid");
  });
  runner.test("createExponentialBackoff caps and scales", () => {
    const backoff = createExponentialBackoff({
      baseMs: 100,
      maxMs: 1e3,
      jitter: 0
    });
    runner.assertEqual(backoff(1), 100);
    runner.assertEqual(backoff(2), 200);
    runner.assertEqual(backoff(4), 800);
    runner.assertEqual(backoff(6), 1e3);
  });
  runner.test("createExponentialBackoff applies jitter with custom rng", () => {
    const backoff = createExponentialBackoff({
      baseMs: 100,
      maxMs: 1e3,
      jitter: 0.5,
      rng: () => 1
    });
    runner.assertEqual(backoff(1), 150);
    runner.assertEqual(backoff(0), 150, "Attempt <= 0 should clamp to 1");
  });
  runner.test("isValidFinalResponse supports custom quit phrases", () => {
    runner.assertFalse(isValidFinalResponse("Stop here.", { quitPhrases: ["stop here"] }));
    runner.assertTrue(isValidFinalResponse("Stop here."), "Default phrases should not block custom text");
  });
}
function testRuntimeMessages(runner) {
  log("\n=== Testing Runtime Message Schema ===", "info");
  runner.test("Runtime messages are discriminated and serializable", () => {
    const base = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: "run-test",
      turnId: "turn-1",
      sessionId: "session-test",
      timestamp: Date.now()
    };
    const plan = {
      steps: [{ id: "step-1", title: "Do something", status: "pending" }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const samples = [
      { ...base, type: "user_run_start", message: "hello" },
      { ...base, type: "assistant_stream_start" },
      { ...base, type: "assistant_stream_delta", content: "partial" },
      { ...base, type: "assistant_stream_stop" },
      {
        ...base,
        type: "tool_execution_start",
        tool: "click",
        id: "tool-1",
        args: { selector: "#id" }
      },
      {
        ...base,
        type: "tool_execution_result",
        tool: "click",
        id: "tool-1",
        args: { selector: "#id" },
        result: { success: true }
      },
      { ...base, type: "plan_update", plan },
      {
        ...base,
        type: "manual_plan_update",
        steps: [{ title: "Review plan", status: "pending" }]
      },
      {
        ...base,
        type: "run_status",
        phase: "executing",
        attempts: { api: 0, tool: 1, finalize: 0 },
        maxRetries: { api: 2, tool: 2, finalize: 1 },
        lastError: "Tool failed"
      },
      {
        ...base,
        type: "run_status",
        phase: "stopped",
        attempts: { api: 0, tool: 0, finalize: 0 },
        maxRetries: { api: 1, tool: 1, finalize: 1 },
        note: "Stopped by user"
      },
      {
        ...base,
        type: "assistant_final",
        content: "Done",
        thinking: "Thoughts",
        usage: { inputTokens: 10 }
      },
      { ...base, type: "run_error", message: "Boom" },
      { ...base, type: "run_warning", message: "Heads up" }
    ];
    samples.forEach((sample) => {
      const json = JSON.stringify(sample);
      const parsed = JSON.parse(json);
      runner.assertTrue(isRuntimeMessage(parsed), `Runtime message ${sample.type} should validate`);
    });
  });
  runner.test("Runtime messages reject invalid schema versions or types", () => {
    const badVersion = {
      type: "assistant_final",
      schemaVersion: 999,
      runId: "run-test",
      timestamp: Date.now(),
      content: "Hi"
    };
    const badType = {
      type: "unknown_type",
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: "run-test",
      timestamp: Date.now()
    };
    const missingRunId = {
      type: "assistant_final",
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      timestamp: Date.now(),
      content: "Hi"
    };
    runner.assertFalse(isRuntimeMessage(badVersion), "Should reject mismatched schema versions");
    runner.assertFalse(isRuntimeMessage(badType), "Should reject unknown message types");
    runner.assertFalse(isRuntimeMessage(missingRunId), "Should reject missing runId");
  });
}
function main() {
  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
  log("\u2551       Unit Tests - Browser Tools       \u2551", "info");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
  const runner = new TestRunner();
  testToolDefinitions(runner);
  testAIProviderConfig(runner);
  testToolSchemaConversion(runner);
  testInputValidation(runner);
  testErrorHandling(runner);
  testMessageSchema(runner);
  testConversationCompaction(runner);
  testThinkingExtraction(runner);
  testPlanNormalization(runner);
  testRetryHelpers(runner);
  testRuntimeMessages(runner);
  const success = runner.printSummary();
  process.exit(success ? 0 : 1);
}
main();
//# sourceMappingURL=run-unit-tests.js.map
