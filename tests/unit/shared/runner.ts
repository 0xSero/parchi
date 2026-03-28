export const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m',
} as const;

export function log(message: string, type: keyof typeof colors = 'info'): void {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

export class TestRunner {
  passed: number;
  failed: number;
  errors: Array<{ test: string; error: string }>;
  private readonly pendingTests: Promise<void>[];

  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.pendingTests = [];
  }

  test(description: string, fn: () => void | Promise<void>) {
    try {
      const result = fn();
      if (result && typeof (result as PromiseLike<void>).then === 'function') {
        const pending = Promise.resolve(result)
          .then(() => {
            this.passed++;
            log(`✓ ${description}`, 'success');
          })
          .catch((error: unknown) => {
            const err = error instanceof Error ? error : new Error(String(error));
            this.failed++;
            this.errors.push({ test: description, error: err.message });
            log(`✗ ${description}: ${err.message}`, 'error');
          });
        this.pendingTests.push(pending);
        return true;
      }
      this.passed++;
      log(`✓ ${description}`, 'success');
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
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

  async assertRejects(
    promise: Promise<unknown>,
    expectedSubstring?: string,
    message = 'Should have rejected with an error',
  ): Promise<void> {
    try {
      await promise;
      throw new Error(message);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message === message) {
        throw err;
      }
      if (expectedSubstring && !err.message.includes(expectedSubstring)) {
        throw new Error(`${message}
Missing: ${expectedSubstring}
Actual: ${err.message}`);
      }
    }
  }

  async waitForPendingTests(): Promise<void> {
    if (this.pendingTests.length === 0) return;
    await Promise.all(this.pendingTests);
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
