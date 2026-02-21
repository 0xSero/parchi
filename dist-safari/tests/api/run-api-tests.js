#!/usr/bin/env node

// tests/api/run-api-tests.ts
import { streamText } from "ai";

// packages/extension/ai/message-utils.ts
function extractTextFromResponseMessages(messages) {
  if (!Array.isArray(messages)) return "";
  const collected = [];
  const collectFromContent = (content) => {
    if (!content) return;
    if (typeof content === "string") {
      if (content.trim()) collected.push(content);
      return;
    }
    if (Array.isArray(content)) {
      content.forEach((part) => collectFromContent(part));
      return;
    }
    if (content && typeof content === "object") {
      const type = typeof content.type === "string" ? String(content.type).toLowerCase() : "";
      if (type && (type.includes("thinking") || type.includes("reasoning") || type.includes("analysis"))) {
        return;
      }
      if (type && (type.includes("tool") || type.includes("function"))) {
        return;
      }
      const text = typeof content.text === "string" ? content.text : typeof content.content === "string" ? content.content : "";
      if (text && text.trim()) collected.push(text);
    }
  };
  messages.forEach((msg) => collectFromContent(msg?.content));
  return collected.join("").trim();
}

// packages/extension/ai/sdk-client.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, jsonSchema, tool } from "ai";
function resolveLanguageModel(settings) {
  const provider = settings.provider || "openai";
  const modelId = settings.model || "gpt-4o";
  const apiKey = settings.apiKey || "";
  const extraHeaders = settings.extraHeaders && typeof settings.extraHeaders === "object" ? settings.extraHeaders : void 0;
  if (settings.useProxy && settings.proxyBaseUrl && settings.proxyAuthToken) {
    const normalizedBase = settings.proxyBaseUrl.replace(/\/+$/, "");
    const proxyProvider = settings.proxyProvider || (provider === "anthropic" || provider === "kimi" ? "anthropic" : "openai");
    if (proxyProvider === "anthropic") {
      const anthropicProxy = createAnthropic({
        apiKey: "convex-proxy",
        baseURL: `${normalizedBase}/ai-proxy/anthropic/v1`,
        headers: {
          ...extraHeaders,
          Authorization: `Bearer ${settings.proxyAuthToken}`
        }
      });
      return anthropicProxy(modelId);
    }
    if (proxyProvider === "kimi") {
      const kimiProxy = createAnthropic({
        apiKey: "convex-proxy",
        baseURL: `${normalizedBase}/ai-proxy/kimi/v1`,
        headers: {
          ...extraHeaders,
          Authorization: `Bearer ${settings.proxyAuthToken}`
        }
      });
      return kimiProxy(modelId);
    }
    const openAiProxy = createOpenAICompatible({
      name: "convex-proxy",
      apiKey: settings.proxyAuthToken,
      baseURL: `${normalizedBase}/ai-proxy/openai`,
      headers: extraHeaders
    });
    return openAiProxy(modelId);
  }
  if (provider === "anthropic") {
    const providerInstance2 = createAnthropic({ apiKey, headers: extraHeaders });
    return providerInstance2(modelId);
  }
  if (provider === "kimi") {
    let baseURL = (settings.customEndpoint || "https://api.kimi.com/coding").replace(/\/v1\/messages\/?$/i, "").replace(/\/messages\/?$/i, "").replace(/\/+$/, "");
    if (!/\/v1$/i.test(baseURL)) {
      baseURL = `${baseURL}/v1`;
    }
    const kimiProvider = createAnthropic({
      apiKey,
      baseURL,
      headers: extraHeaders
    });
    return kimiProvider(modelId);
  }
  if (provider === "custom") {
    const rawBase = settings.customEndpoint ? settings.customEndpoint.replace(/\/chat\/completions\/?$/i, "").replace(/\/v1\/messages\/?$/i, "").replace(/\/messages\/?$/i, "").replace(/\/+$/, "") : "";
    const baseURL = rawBase;
    if (!baseURL) {
      throw new Error("Custom provider requires a customEndpoint to be configured");
    }
    const customProvider = createOpenAICompatible({
      name: provider,
      apiKey,
      baseURL,
      headers: extraHeaders
    });
    return customProvider(modelId);
  }
  const providerInstance = createOpenAI({ apiKey, headers: extraHeaders });
  return providerInstance(modelId);
}

// tests/api/run-api-tests.ts
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
var readEnv = (key) => {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
};
var providers = [
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
async function runProvider(spec) {
  const apiKey = readEnv(spec.apiKeyEnv);
  if (!apiKey) {
    log(`- ${spec.label}: skipped (missing ${spec.apiKeyEnv})`, "warning");
    return { skipped: true };
  }
  const model = readEnv(spec.modelEnv) || spec.defaultModel || "";
  if (!model) {
    log(`- ${spec.label}: skipped (missing ${spec.modelEnv})`, "warning");
    return { skipped: true };
  }
  const customEndpoint = spec.endpointEnv ? readEnv(spec.endpointEnv) : "";
  const modelInstance = resolveLanguageModel({
    provider: spec.provider,
    apiKey,
    model,
    customEndpoint: customEndpoint || void 0
  });
  const prompt = 'Reply with the word "pong" only.';
  const result = streamText({
    model: modelInstance,
    messages: [{ role: "user", content: prompt }],
    maxOutputTokens: 32
  });
  let rawText = "";
  let responseMessages = null;
  try {
    [rawText, responseMessages] = await Promise.all([result.text, result.responseMessages]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    throw new Error(`${spec.label} request failed: ${message}`);
  }
  const fallbackText = extractTextFromResponseMessages(responseMessages);
  const resolvedText = (rawText || fallbackText || "").trim();
  if (!resolvedText) {
    throw new Error(`${spec.label} returned empty text (raw + fallback).`);
  }
  if (!resolvedText.toLowerCase().includes("pong")) {
    throw new Error(`${spec.label} unexpected response: ${resolvedText.slice(0, 200)}`);
  }
  const usedFallback = !rawText || !rawText.trim();
  const suffix = usedFallback ? " (used responseMessages fallback)" : "";
  log(`\u2713 ${spec.label}: OK${suffix}`, "success");
  return { skipped: false };
}
async function main() {
  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
  log("\u2551        API Smoke Tests (Live)         \u2551", "info");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
  let ranAny = false;
  let failed = false;
  for (const spec of providers) {
    try {
      const result = await runProvider(spec);
      if (!result.skipped) ranAny = true;
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
      log(`\u2717 ${spec.label}: ${message}`, "error");
    }
  }
  if (!ranAny) {
    log("No API credentials configured. Set at least one provider env var to run tests.", "warning");
  }
  if (failed) {
    log("API smoke tests failed.", "error");
    process.exit(1);
  }
  log("API smoke tests complete.", "success");
  process.exit(0);
}
main();
//# sourceMappingURL=run-api-tests.js.map
