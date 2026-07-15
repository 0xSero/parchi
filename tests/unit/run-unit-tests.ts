#!/usr/bin/env node

/**
 * Unit Test Runner
 * Tests individual components without Chrome APIs
 */

import { pathToFileURL } from 'node:url';
import { runCompactionStressTestV2Suite } from './compaction-stress-test-v2.test.js';
import { TestRunner, log } from './shared/runner.js';
import { runAiProviderConfigSuite } from './suites/ai-provider-config.test.js';
import { runApiErrorClassificationSuite } from './suites/api-error-classification.test.js';
import { runBrowserCspClickFallbackSuite } from './suites/browser-csp-click-fallback.test.js';
import { runBrowserCspFieldReportSuite } from './suites/browser-csp-field-report.test.js';
import { runBrowserCspHardeningSuite } from './suites/browser-csp-hardening.test.js';
import { runBrowserDebugFirefoxGuardSuite } from './suites/browser-debug-firefox-guard.test.js';
import { runBrowserEvalSerializationSuite } from './suites/browser-eval-serialization.test.js';
import { runCodexOauthConfigSuite } from './suites/codex-oauth-config.test.js';
import { runConversationCompactionSuite } from './suites/conversation-compaction.test.js';
import { runErrorHandlingSuite } from './suites/error-handling.test.js';
import { runInputValidationSuite } from './suites/input-validation.test.js';
import { runJsonRpcMutualExclusivitySuite } from './suites/json-rpc/mutual-exclusivity.test.js';
import { runJsonRpcNotificationSuite } from './suites/json-rpc/notification.test.js';
import { runJsonRpcRequestSuite } from './suites/json-rpc/request.test.js';
import { runJsonRpcResponseSuite } from './suites/json-rpc/response.test.js';
import { runMessageSchemaSuite } from './suites/message-schema.test.js';
import { runMessageUtilsSuite } from './suites/message-utils.test.js';
import { runModelCapabilitiesSuite } from './suites/model-capabilities.test.js';
import { runModelListingSuite } from './suites/model-listing.test.js';
import { runModelMessageConvertSuite } from './suites/model-message-convert.test.js';
import { runOauthCandidatesSuite } from './suites/oauth-candidates.test.js';
import { runOauthModelNormalizationSuite } from './suites/oauth-model-normalization.test.js';
import { runOauthProfileContextSyncSuite } from './suites/oauth-profile-context-sync.test.js';
import { runOrchestratorNormalizationSuite } from './suites/orchestrator-normalization.test.js';
import { runPanelSessionMemorySuite } from './suites/panel-session-memory.test.js';
import { runPlanNormalizationSuite } from './suites/plan-normalization.test.js';
import { runProfileCompatibilitySuite } from './suites/profile/compatibility.test.js';
import { runConnectionGuardSuite } from './suites/profile/connection-guard.test.js';
import { runCreateProfileSuite } from './suites/profile/create-profile.test.js';
import { runExtractConnectionConfigSuite } from './suites/profile/extract-connection-config.test.js';
import { runExtractFromProviderSuite } from './suites/profile/extract-from-provider.test.js';
import { runResolveProfileSuite } from './suites/profile/resolve-profile.test.js';
import { runVisionSettingsSuite } from './suites/profile/vision-settings.test.js';
import { runProviderInstanceBaseTypeSuite } from './suites/provider-instance/base-type.test.js';
import { runProviderInstanceFeaturesSuite } from './suites/provider-instance/features.test.js';
import { runRecordingSummarySuite } from './suites/recording-summary.test.js';
import { runReportImagesSuite } from './suites/report-images.test.js';
import { runRetryHelpersSuite } from './suites/retry-helpers.test.js';
import {
  runRuntimeMessagesCoreSuite,
  runRuntimeMessagesImagesSuite,
  runRuntimeMessagesSessionSuite,
  runRuntimeMessagesStreamingSuite,
  runRuntimeMessagesValidationSuite,
} from './suites/runtime-messages/index.js';
import { runRuntimeProfileRoutingSuite } from './suites/runtime-profile-routing.test.js';
import { runRuntimeTypesSuite } from './suites/runtime-types.test.js';
import { runStatePersistenceSuite } from './suites/state-persistence.test.js';
import { runThinkingExtractionSuite } from './suites/thinking-extraction.test.js';
import { runToolDefinitionsSuite } from './suites/tool-definitions.test.js';
import { runToolSchemaConversionSuite } from './suites/tool-schema-conversion.test.js';
import { runXmlToolParserSuite } from './suites/xml-tool-parser.test.js';

export async function runUnitTests() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║       Unit Tests - Browser Tools       ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  const runner = new TestRunner();

  await runToolDefinitionsSuite(runner);
  await runBrowserEvalSerializationSuite(runner);
  await runBrowserDebugFirefoxGuardSuite(runner);
  await runBrowserCspHardeningSuite(runner);
  await runBrowserCspClickFallbackSuite(runner);
  await runBrowserCspFieldReportSuite(runner);
  await runAiProviderConfigSuite(runner);
  await runToolSchemaConversionSuite(runner);
  await runInputValidationSuite(runner);
  await runErrorHandlingSuite(runner);
  await runApiErrorClassificationSuite(runner);
  await runOauthModelNormalizationSuite(runner);
  await runOauthProfileContextSyncSuite(runner);
  await runOauthCandidatesSuite(runner);
  await runRuntimeProfileRoutingSuite(runner);
  await runCodexOauthConfigSuite(runner);
  await runMessageSchemaSuite(runner);
  await runModelMessageConvertSuite(runner);
  await runConversationCompactionSuite(runner);
  await runCompactionStressTestV2Suite(runner);
  await runThinkingExtractionSuite(runner);
  await runMessageUtilsSuite(runner);
  await runModelListingSuite(runner);
  await runModelCapabilitiesSuite(runner);
  await runReportImagesSuite(runner);
  await runRecordingSummarySuite(runner);
  await runPanelSessionMemorySuite(runner);
  await runPlanNormalizationSuite(runner);
  await runCreateProfileSuite(runner);
  await runResolveProfileSuite(runner);
  await runVisionSettingsSuite(runner);
  await runExtractConnectionConfigSuite(runner);
  await runExtractFromProviderSuite(runner);
  await runConnectionGuardSuite(runner);
  await runProfileCompatibilitySuite(runner);
  await runProviderInstanceBaseTypeSuite(runner);
  await runProviderInstanceFeaturesSuite(runner);
  await runRetryHelpersSuite(runner);
  await runRuntimeMessagesCoreSuite(runner);
  await runRuntimeMessagesValidationSuite(runner);
  await runRuntimeMessagesStreamingSuite(runner);
  await runRuntimeMessagesImagesSuite(runner);
  await runRuntimeMessagesSessionSuite(runner);
  await runRuntimeTypesSuite(runner);
  await runStatePersistenceSuite(runner);
  await runXmlToolParserSuite(runner);
  await runOrchestratorNormalizationSuite(runner);
  await runJsonRpcRequestSuite(runner);
  await runJsonRpcNotificationSuite(runner);
  await runJsonRpcResponseSuite(runner);
  await runJsonRpcMutualExclusivitySuite(runner);

  return runner.printSummary();
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  const success = await runUnitTests();
  process.exit(success ? 0 : 1);
}
