# Cleanup Worker Skill

Execute cleanup tasks for the browser-ai codebase.

## Task Types

### 1. Remove Orphaned Files

**Procedure:**
1. Verify file is truly orphaned:
   ```bash
   grep -r "from.*orphaned-file" packages/extension/src --include="*.ts"
   ```
2. If no imports found, delete the file
3. Run `npm run build` to verify no broken imports
4. Run `npm run typecheck` to verify types

**Verification:**
- File no longer exists
- Build succeeds
- No broken imports

### 2. Consolidate Duplicate Functions

**Procedure:**
1. Create shared utility in `packages/shared/src/utils/`:
   - `type-guards.ts` for asRecord, asString
   - `async.ts` for sleep
   - `strings.ts` for truncate
2. Export from `packages/shared/src/index.ts`
3. Replace all local implementations with imports
4. Delete local implementations

**Verification:**
- grep shows only shared + imports
- Build succeeds
- Type check passes

### 3. Fix Memory Leaks

**Procedure:**
1. Identify the leak source:
   - DOM elements not removed?
   - Listeners not removed?
   - Observers not disconnected?
2. Store reference to listener/element/observer
3. Add cleanup method
4. Ensure cleanup is called (lifecycle hook, disconnect event, etc.)

**Verification:**
- Cleanup method exists and is called
- Build succeeds
- No type errors

### 4. Fix Empty Catch Blocks

**Procedure:**
1. Find empty catches: `grep -r "catch\s*{" --include="*.ts"`
2. Add appropriate error handling:
   - `console.warn()` for non-critical errors
   - Telemetry for analytics
   - Re-throw for critical errors
3. Include context in log message

**Verification:**
- No empty catch blocks remain
- Errors are logged or handled
- Build succeeds

### 5. Fix Type Safety Issues

**Procedure:**
1. For `Record<string, any>`:
   - Change to `Record<string, unknown>`
   - Add type guards where values are accessed
2. For missing return types:
   - Add explicit return type annotation
3. For `catch (err: any)`:
   - Change to `catch (err: unknown)`
   - Use `if (err instanceof Error)` before accessing properties
4. For `as unknown as X`:
   - Add proper type guards
   - Or use `satisfies` keyword if appropriate

**Verification:**
- `npm run typecheck` passes
- No new type errors
- Runtime behavior unchanged

### 6. Clean CSS

**Procedure:**
1. Find unused selectors (from analysis report)
2. Verify not used in HTML/TS templates
3. Remove selector and rules
4. Consolidate duplicate keyframes

**Verification:**
- CSS files valid
- Build succeeds
- No visual regressions (manual check)

## Handoff Requirements

When completing a feature, provide:
1. Summary of changes made
2. Files modified/deleted
3. Build and type check status
4. Any issues encountered
5. Recommendations for related cleanup

## Error Handling

If a task cannot be completed:
1. Document the blocker
2. Report to orchestrator
3. Do not leave partially broken code

## Safety Rules

1. Always run build after changes
2. Always run typecheck after changes
3. Never delete files without verifying they're orphaned
4. Never change runtime behavior (fix bugs, not features)
5. Keep commits atomic and revertible
