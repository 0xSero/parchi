---
name: refactor-worker
description: Refactors TypeScript code while preserving functionality, ensuring files stay under 200 lines
---

# Refactor Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use this worker for refactoring features that involve:
- Consolidating duplicate code
- Splitting large files into smaller modules
- Extracting shared types and utilities
- Simplifying complex logic
- Unifying patterns across the codebase

## Work Procedure

### 1. Understand the Feature Scope

Read the feature description carefully. Identify:
- Which files need to be refactored
- What behavior must be preserved
- Any dependencies on other features

### 2. Establish Baseline

Before making changes:
```bash
# Run tests to establish baseline
npm run test:unit -- --grep '<relevant-pattern>'

# Check current file sizes
wc -l <files-to-refactor>

# Run typecheck
npm run typecheck
```

Document any pre-existing test failures or issues.

### 3. Plan the Refactoring

- Identify what can be extracted into separate modules
- Determine the new file structure
- Plan the interfaces between modules
- Consider: Will this break any imports in other files?

### 4. Write Tests First (TDD)

If tests don't exist for the code being refactored:
1. Write tests that capture current behavior
2. Run tests to ensure they pass
3. Then proceed with refactoring

If tests exist:
1. Run them to ensure they pass
2. Update imports if needed during refactoring
3. Keep tests passing throughout

### 5. Refactor Incrementally

Make small, focused changes:
1. Extract one module at a time
2. Run tests after each extraction
3. Run typecheck after each extraction
4. Commit logical units

### 6. Verify File Size Limits

After refactoring:
```bash
# Check all affected files are <= 200 lines
wc -l <affected-files>

# If any file is over 200 lines, continue splitting
```

### 7. Update Imports

Ensure all imports are updated:
1. Files that import from refactored modules
2. Export statements in new modules
3. Index files if applicable

### 8. Final Validation

```bash
# Full typecheck
npm run typecheck

# Run all related tests
npm run test:unit
npm run test:integration

# Lint check
npm run lint

# Build check
npm run build
```

### 9. Document Changes

Update any affected:
- Inline documentation
- Type annotations
- README sections if architecture changed

## Example Handoff

```json
{
  "salientSummary": "Refactored panel-core.ts (1541 lines) into 6 focused modules: trace-sanitizer.ts (89 lines), history-manager.ts (112 lines), message-processor.ts (145 lines), state-manager.ts (98 lines), event-handler.ts (134 lines), and panel-core.ts (167 lines). All tests pass, typecheck clean, build succeeds.",
  "whatWasImplemented": "Split panel-core.ts into 6 modules with clear responsibilities. Extracted trace sanitization logic, history management, message processing, state management, and event handling into separate files. Updated all imports in sidepanel UI. Added unit tests for trace-sanitizer.ts and history-manager.ts.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "npm run typecheck",
        "exitCode": 0,
        "observation": "No TypeScript errors"
      },
      {
        "command": "npm run test:unit -- --grep 'panel-core'",
        "exitCode": 0,
        "observation": "23 tests passed"
      },
      {
        "command": "wc -l packages/extension/sidepanel/ui/core/*.ts",
        "exitCode": 0,
        "observation": "All files under 200 lines, largest is panel-core.ts at 167 lines"
      },
      {
        "command": "npm run build",
        "exitCode": 0,
        "observation": "Build succeeded, dist/ updated"
      }
    ],
    "interactiveChecks": [
      {
        "action": "Loaded extension in Chrome and opened sidepanel",
        "observed": "UI renders correctly, chat works, settings accessible"
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/unit/trace-sanitizer.test.ts",
        "cases": [
          {"name": "sanitizes long strings", "verifies": "VAL-QUALITY-002"},
          {"name": "handles circular references", "verifies": "VAL-QUALITY-002"},
          {"name": "caps array items", "verifies": "VAL-QUALITY-002"}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

Return to the orchestrator if:

1. **Pre-existing test failures** block your refactoring (not caused by your changes)
2. **Circular dependencies** discovered that require architectural decisions
3. **Scope creep** - the refactoring requires changes beyond the feature description
4. **Breaking changes** required that affect external interfaces
5. **Cannot achieve 200 line limit** without losing functionality
6. **Dependencies missing** - needed packages or services unavailable

## Refactoring Principles

1. **Preserve behavior first** - functionality must not change
2. **Small steps** - refactor incrementally, test frequently
3. **Extract, don't rewrite** - move code, don't reimplement
4. **Clear module boundaries** - each module has one responsibility
5. **Explicit dependencies** - inject dependencies, don't hide them
6. **Document intent** - add comments explaining why, not what
