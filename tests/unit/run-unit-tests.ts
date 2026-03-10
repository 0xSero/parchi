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
import { runCodexOauthConfigSuite } from './suites/codex-oauth-config.test.js';
import { runConversationCompactionSuite } from './suites/conversation-compaction.test.js';
import { runErrorHandlingSuite } from './suites/error-handling.test.js';
import { runInputValidationSuite } from './suites/input-validation.test.js';
import { runMessageSchemaSuite } from './suites/message-schema.test.js';
import { runMessageUtilsSuite } from './suites/message-utils.test.js';
import { runModelListingSuite } from './suites/model-listing.test.js';
import { runModelMessageConvertSuite } from './suites/model-message-convert.test.js';
import { runOauthCandidatesSuite } from './suites/oauth-candidates.test.js';
import { runOauthModelNormalizationSuite } from './suites/oauth-model-normalization.test.js';
import { runOrchestratorNormalizationSuite } from './suites/orchestrator-normalization.test.js';
import { runPanelSessionMemorySuite } from './suites/panel-session-memory.test.js';
import { runPlanNormalizationSuite } from './suites/plan-normalization.test.js';
import { runRecordingSummarySuite } from './suites/recording-summary.test.js';
import { runReportImagesSuite } from './suites/report-images.test.js';
import { runRetryHelpersSuite } from './suites/retry-helpers.test.js';
import { runRuntimeMessagesSuite } from './suites/runtime-messages.test.js';
import { runRuntimeProfileRoutingSuite } from './suites/runtime-profile-routing.test.js';
import { runRuntimeTypesSuite } from './suites/runtime-types.test.js';
import { runStatePersistenceSuite } from './suites/state-persistence.test.js';
import { runThinkingExtractionSuite } from './suites/thinking-extraction.test.js';
import { runToolDefinitionsSuite } from './suites/tool-definitions.test.js';
import { runToolSchemaConversionSuite } from './suites/tool-schema-conversion.test.js';
import { runXmlToolParserSuite } from './suites/xml-tool-parser.test.js';

export function runUnitTests() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║       Unit Tests - Browser Tools       ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  const runner = new TestRunner();

  runToolDefinitionsSuite(runner);
  runAiProviderConfigSuite(runner);
  runToolSchemaConversionSuite(runner);
  runInputValidationSuite(runner);
  runErrorHandlingSuite(runner);
  runApiErrorClassificationSuite(runner);
  runOauthModelNormalizationSuite(runner);
  runOauthCandidatesSuite(runner);
  runRuntimeProfileRoutingSuite(runner);
  runCodexOauthConfigSuite(runner);
  runMessageSchemaSuite(runner);
  runModelMessageConvertSuite(runner);
  runConversationCompactionSuite(runner);
  runCompactionStressTestV2Suite(runner);
  runThinkingExtractionSuite(runner);
  runMessageUtilsSuite(runner);
  runModelListingSuite(runner);
  runReportImagesSuite(runner);
  runRecordingSummarySuite(runner);
  runPanelSessionMemorySuite(runner);
  runPlanNormalizationSuite(runner);
  runRetryHelpersSuite(runner);
  runRuntimeMessagesSuite(runner);
  runRuntimeTypesSuite(runner);
  runStatePersistenceSuite(runner);
  runXmlToolParserSuite(runner);
  runOrchestratorNormalizationSuite(runner);

  return runner.printSummary();
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  const success = runUnitTests();
  process.exit(success ? 0 : 1);
}
