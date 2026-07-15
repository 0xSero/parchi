#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { AsyncTestRunner, log } from './shared/runner.js';
import { runCspHardeningPromptSuite } from './suites/csp-hardening-prompt.integration.test.js';
import { runModelListingIntegrationSuite } from './suites/model-listing.integration.test.js';
import { runPromptAndCatalogIntegrationSuite } from './suites/prompt-and-catalog.integration.test.js';
import { runToolPermissionsAndReportImagesSuite } from './suites/tool-permissions-and-report-images.integration.test.js';
import { runXmlAndRecordingIntegrationSuite } from './suites/xml-and-recording.integration.test.js';

export async function runIntegrationTests() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║   Headless Runtime Integration Tests   ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  const runner = new AsyncTestRunner();

  await runModelListingIntegrationSuite(runner);
  await runPromptAndCatalogIntegrationSuite(runner);
  await runCspHardeningPromptSuite(runner);
  await runToolPermissionsAndReportImagesSuite(runner);
  await runXmlAndRecordingIntegrationSuite(runner);

  return runner.printSummary();
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  const success = await runIntegrationTests();
  process.exit(success ? 0 : 1);
}
