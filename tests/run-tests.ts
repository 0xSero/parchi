#!/usr/bin/env node

/**
 * Main Test Runner
 * Runs all tests including validation and unit tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function runCommand(command: string, description: string) {
  log(`\n▶ ${description}...`, 'info');
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    log(`✓ ${description} completed`, 'success');
    return true;
  } catch (error) {
    log(`✗ ${description} failed`, 'error');
    console.error(error.stdout || error.stderr || error.message);
    return false;
  }
}

async function main() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║           Parchi - Test Suite         ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  let allPassed = true;

  // Run validation
  allPassed = (await runCommand('node dist/tests/validate-extension.js', 'Extension Validation')) && allPassed;

  // Run unit tests
  allPassed = (await runCommand('node dist/tests/unit/run-unit-tests.js', 'Unit Tests')) && allPassed;

  // Summary
  log('\n' + '═'.repeat(40), 'info');
  if (allPassed) {
    log('✓ All tests passed!', 'success');
    log('Extension is ready to use.', 'success');
    process.exit(0);
  } else {
    log('✗ Some tests failed', 'error');
    log('Please fix the issues above.', 'error');
    process.exit(1);
  }
}

main();
