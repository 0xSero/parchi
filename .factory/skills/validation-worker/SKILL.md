---
name: validation-worker
description: Validates refactored code through testing, coverage analysis, and quality gate checks
---

# Validation Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use this worker for validation features that involve:
- Running integration test suites
- Running E2E tests with external providers
- Validating coverage thresholds
- Checking file size limits
- Running quality gates (typecheck, lint, build, knip)
- Final extension loading verification

## Work Procedure

### 1. Understand Validation Scope

Read the feature description to understand:
- What tests need to run
- What thresholds must be met
- What quality gates apply

### 2. Run Tests

For integration tests:
```bash
npm run test:integration
```

For E2E tests:
```bash
DECOMPOSER_PROVIDER=openai-compatible \
DECOMPOSER_BASE_URL=https://api.minimax.io/v1 \
DECOMPOSER_API_KEY=$DECOMPOSER_API_KEY \
npm run test:e2e
```

### 3. Analyze Results

- Document all test failures
- Categorize failures:
  - **Pre-existing**: Known issues not caused by refactoring
  - **Regression**: New failures caused by refactoring
  - **Flaky**: Intermittent failures

### 4. Fix Regressions

If tests fail due to refactoring:
1. Identify the root cause
2. Make minimal fix
3. Re-run tests
4. Document the fix

### 5. Coverage Validation

```bash
npm run test:coverage
```

Check coverage report:
- Strict files: 100% lines, functions, statements
- Broad targets: 95% lines, 75% branches, 95% functions

If below threshold:
1. Identify uncovered code
2. Write additional tests
3. Re-run coverage

### 6. File Size Validation

```bash
# Find files over 200 lines
find packages -name '*.ts' -exec wc -l {} \; | awk '$1 > 200 {print}'
```

Report any files exceeding the limit.

### 7. Quality Gates

Run all quality gates:
```bash
npm run typecheck  # TypeScript compilation
npm run lint       # Biome linting
npm run build      # Production build
npm run knip       # Unused export detection
```

Document any issues and fix if possible.

### 8. Extension Loading (if applicable)

1. Build extension: `npm run build`
2. Load in Chrome as unpacked extension
3. Open sidepanel
4. Check console for errors
5. Take screenshot of working UI

### 9. Generate Report

Compile validation results:
- Test pass/fail counts
- Coverage percentages
- Files over 200 lines
- Quality gate status
- Screenshots (if applicable)

## Example Handoff

```json
{
  "salientSummary": "Validated all quality gates for the refactoring mission. Integration tests: 47/47 passed. E2E tests: 12/12 passed with MiniMax provider. Coverage: 96.2% lines, 78.4% branches, 97.1% functions. All files under 200 lines. Typecheck, lint, build, knip all pass. Extension loads correctly in Chrome.",
  "whatWasImplemented": "Ran full validation suite including integration tests, E2E tests with MiniMax provider, coverage analysis, file size checks, and all quality gates. Fixed 2 minor lint issues. Added 3 tests to improve coverage on trace-sanitizer module.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npm run test:integration",
        "exitCode": 0,
        "observation": "47 tests passed in 12.3s"
      },
      {
        "command": "DECOMPOSER_PROVIDER=openai-compatible DECOMPOSER_BASE_URL=https://api.minimax.io/v1 npm run test:e2e",
        "exitCode": 0,
        "observation": "12 tests passed, 2 skipped (require browser)"
      },
      {
        "command": "npm run test:coverage",
        "exitCode": 0,
        "observation": "Coverage meets thresholds: lines 96.2%, branches 78.4%, functions 97.1%"
      },
      {
        "command": "find packages -name '*.ts' -exec wc -l {} \\; | awk '$1 > 200'",
        "exitCode": 0,
        "observation": "No files over 200 lines"
      },
      {
        "command": "npm run typecheck && npm run lint && npm run build && npm run knip",
        "exitCode": 0,
        "observation": "All quality gates passed"
      }
    ],
    "interactiveChecks": [
      {
        "action": "Loaded extension in Chrome from dist/",
        "observed": "Extension loaded without errors, sidepanel opens, UI renders correctly"
      },
      {
        "action": "Sent test prompt through chat interface",
        "observed": "Agent responded correctly, streaming worked, no console errors"
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/unit/trace-sanitizer-coverage.test.ts",
        "cases": [
          {"name": "handles data URLs", "verifies": "VAL-QUALITY-002"},
          {"name": "handles Error objects", "verifies": "VAL-QUALITY-002"},
          {"name": "handles BigInt values", "verifies": "VAL-QUALITY-002"}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

Return to the orchestrator if:

1. **Pre-existing failures** block validation (not caused by refactoring)
2. **Coverage cannot be achieved** without significant new code
3. **Files cannot be reduced** below 200 lines without breaking functionality
4. **Quality gates fail** due to issues outside refactoring scope
5. **E2E tests blocked** by external service issues
6. **Extension fails to load** due to fundamental issues

## Validation Principles

1. **Be thorough** - run all required validations
2. **Document everything** - pass/fail status, coverage numbers, file sizes
3. **Fix regressions** - but don't expand scope
4. **Report blockers** - don't silently skip failing tests
5. **Provide evidence** - screenshots, command output, coverage reports
