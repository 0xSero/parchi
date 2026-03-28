#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { runIntegrationTests } from './integration/run-integration-tests.js';
import { runUnitTests } from './unit/run-unit-tests.js';

export async function runHeadlessTests() {
  const unitOk = await runUnitTests();
  const integrationOk = await runIntegrationTests();
  return unitOk && integrationOk;
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  const success = await runHeadlessTests();
  process.exit(success ? 0 : 1);
}
