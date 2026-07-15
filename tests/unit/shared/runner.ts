export const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m',
} as const;

export function log(message: string, type: keyof typeof colors = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

export class TestRunner {
  passed: number;
  failed: number;
  errors: Array<{ test: string; error: string }>;

  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  async test(description: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      this.passed++;
      log(`✓ ${description}`, 'success');
      return true;
    } catch (error) {
      const err = error as Error;
      this.failed++;
      this.errors.push({ test: description, error: err.message });
      log(`✗ ${description}: ${err.message}`, 'error');
      return false;
    }
  }

  assertEqual(actual: unknown, expected: unknown, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
  }

  assertTrue(condition: unknown, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertFalse(condition: unknown, message = 'Assertion failed') {
    if (condition) {
      throw new Error(message);
    }
  }

  assertThrows(fn: () => void, message = 'Should have thrown an error') {
    try {
      fn();
      throw new Error(message);
    } catch (error) {
      const err = error as Error;
      if (err.message === message) {
        throw err;
      }
      // Expected error
    }
  }

  assertIncludes(haystack: string, needle: string, message = 'Expected string to include substring') {
    if (!haystack.includes(needle)) {
      throw new Error(`${message}\nMissing: ${needle}`);
    }
  }

  printSummary() {
    log('\n=== Unit Test Summary ===', 'info');
    log(`Tests Passed: ${this.passed}`, 'success');

    if (this.failed > 0) {
      log(`Tests Failed: ${this.failed}`, 'error');
      log('\nFailed Tests:', 'error');
      this.errors.forEach((e) => {
        log(`  ${e.test}:`, 'error');
        log(`    ${e.error}`, 'error');
      });
    }

    if (this.failed === 0) {
      log('\n✓ All unit tests passed!', 'success');
      return true;
    }

    log('\n✗ Some unit tests failed!', 'error');
    return false;
  }
}
