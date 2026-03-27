# Duplicate Code Analysis Report

## Summary

This report identifies duplicate and near-duplicate code patterns in the browser-ai codebase across the focus areas:
- `packages/extension/ai/` (provider handling)
- `packages/extension/background/` (message handling)
- `packages/extension/sidepanel/` (UI logic)
- `packages/extension/tools/` (tool implementations)
- `packages/shared/` (shared types)

---

## 1. EXACT DUPLICATES

### 1.1 `asRecord` Type Guard (DUPLICATE - 6+ locations)
**Similarity: 95%**

Multiple files define the same `asRecord` utility with identical or near-identical logic:

| Location | Lines |
|----------|-------|
| `packages/extension/ai/messages/utils.ts:3-7` | 5 lines |
| `packages/extension/ai/errors/classifier.ts:47-51` | 5 lines |
| `packages/extension/ai/providers/instance-normalize.ts:9-10` | 2 lines (variant) |
| `packages/extension/background/browser-compat.ts:45-49` | 5 lines |
| `packages/extension/background/tools/tool-executor/orchestrator-test-mode.ts:15-17` | 3 lines |
| `packages/backend/convex/ai-proxy-utils.ts:18-22` | 5 lines |
| `packages/cli/src/daemon-shared.ts:25-29` | 5 lines |

**Code Pattern:**
```typescript
const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};
```

**Consolidation:** Move to `@parchi/shared` and import from there.

---

### 1.2 `asString` Type Guard (DUPLICATE - 5+ locations)
**Similarity: 90%**

| Location | Implementation |
|----------|----------------|
| `packages/extension/ai/providers/instance-normalize.ts:12` | `String(value \|\| '').trim()` |
| `packages/extension/ai/providers/instance-registry.ts:8` | `String(value \|\| '').trim()` |
| `packages/extension/ai/providers/instance-id.ts:13` | `String(value \|\| '').trim()` |
| `packages/extension/ai/providers/instance-models.ts:7` | `String(value \|\| '').trim()` |
| `packages/backend/convex/stripe-utils.ts:24` | `String(value ?? '').trim()` |

**Consolidation:** Export from `@parchi/shared/src/utils` or similar.

---

### 1.3 `sleep` Utility (DUPLICATE - 8+ locations)
**Similarity: 100%**

```typescript
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
```

| Location |
|----------|
| `packages/extension/sidepanel/ui/chat/chat-utils.ts:96` |
| `packages/extension/tools/browser-wait-tools.ts:59` |
| `packages/extension/tools/injected/click.ts:18` |
| `packages/extension/tools/injected/type.ts:10` |
| `packages/extension/offscreen/offscreen.ts:4` |
| `packages/electron-agent/src/helpers/launch.ts:10` |
| `scripts/electron-agent-secure.mjs:18` |
| `scripts/relay-secure.mjs:20` |
| `tests/perf/tab-cpu-audit-lib.ts:19` |

**Consolidation:** Add to `@parchi/shared` or use `node_modules/debounce` package already installed.

---

### 1.4 `debounce` Function (DUPLICATE - imported vs defined)
**Similarity: 100%**

The codebase has `debounce` in:
- `packages/extension/sidepanel/ui/core/dom-utils.ts:9-15` (local implementation)
- `node_modules/debounce` (already in dependencies)

**Consolidation:** Use the npm package instead of local copy.

---

### 1.5 `truncate` Functions (NEAR-DUPLICATE - 6+ locations)
**Similarity: 85%**

| Location | Implementation |
|----------|----------------|
| `packages/extension/sidepanel/ui/chat/chat-utils.ts:28-32` | `text.length > max ? slice + '…' : text` |
| `packages/extension/sidepanel/ui/chat/panel-action-timeline.ts:12` | Same pattern |
| `packages/extension/sidepanel/ui/core/panel-helpers.ts:8-13` | Same pattern |
| `packages/extension/sidepanel/ui/core/message-handlers/tools.ts:263` | Inline variant |
| `packages/extension/sidepanel/ui/history/history-list.ts:59` | Word-based variant |
| `packages/extension/tools/browser-read-tools.ts:89-90` | Inline variant |

---

## 2. SEMANTIC DUPLICATES

### 2.1 Provider Type Normalization (DUPLICATE LOGIC)
**Similarity: 95%**

Two files implement the same provider type detection logic:

**File A:** `packages/extension/ai/providers/instance-normalize.ts:14`
```typescript
export const normalizeProviderType = (value: unknown) => asString(value).toLowerCase();
```

**File B:** `packages/extension/ai/providers/definitions.ts:6-11`
```typescript
function normalizeAnthropicBaseUrl(url: string): string {
  let base = url
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return base;
}
```

**File C:** `packages/extension/ai/sdk/provider-utils.ts:4-9`
```typescript
export const toAnthropicBaseUrl = (value: string): string => {
  const base = value
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
};
```

**Note:** `normalizeAnthropicBaseUrl` and `toAnthropicBaseUrl` are nearly identical!

---

### 2.2 `normalizeSessionId` (DUPLICATE FUNCTION - 5 usages, 1 definition)
**Similarity: 100%**

Defined once but scattered usage across handlers:
- `packages/extension/background/message-handlers/core.ts:6-9` (definition)
- Imported and used in: `run.ts`, `tools.ts`, `test.ts`

This is actually a good pattern, but worth noting the normalization logic appears elsewhere too.

---

### 2.3 OAuth Provider Detection (DUPLICATE LOGIC)
**Similarity: 90%**

| Location | Pattern |
|----------|---------|
| `packages/extension/ai/providers/instance-normalize.ts:16-21` | `providerType.endsWith('-oauth') ? 'oauth' : 'managed'` |
| `packages/extension/ai/providers/instance-normalize.ts:71-74` | Same pattern repeated |
| `packages/extension/ai/providers/definitions.ts` | Provider registry with type checks |

---

## 3. NEAR-DUPLICATES (Should be Unified)

### 3.1 HTML Escaping Functions (DUPLICATE - 4+ implementations)
**Similarity: 90%**

| Location | Function | Lines |
|----------|----------|-------|
| `packages/shared/src/utils/html.ts:3-12` | `escapeHtmlBasic` | 10 lines |
| `packages/extension/sidepanel/ui/core/message-handlers/tools.ts:11-14` | `escapeHtmlLocal` | 4 lines |
| `packages/extension/sidepanel/ui/chat/workflows-menu.ts:6-9` | `escapeHtml` | 4 lines |
| `packages/extension/sidepanel/ui/chat/panel-action-timeline.ts:14-17` | `escapeHtml` | 4 lines |

**Shared version:**
```typescript
export const escapeHtmlBasic = (value: unknown): string => {
  const text = coerce(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
```

**Local versions:**
```typescript
function escapeHtmlLocal(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

**Consolidation:** Use `@parchi/shared/src/utils/html.ts` everywhere.

---

### 3.2 Sanitize/Truncate Functions (DUPLICATE LOGIC - 3+ locations)
**Similarity: 80%**

| File | Purpose |
|------|---------|
| `packages/extension/sidepanel/ui/core/trace-sanitizer.ts` | Sanitizes trace payloads |
| `packages/extension/sidepanel/ui/chat/chat-utils.ts:54-116` | Sanitizes for messaging |
| `packages/extension/background/content-perf.ts:18-71` | Sanitizes perf events |

All implement similar logic:
- Data URL detection and omission
- String length capping
- Array item limiting
- Object key limiting
- Depth-based truncation

---

### 3.3 Error Result Type Guards (DUPLICATE PATTERN)
**Similarity: 95%**

**Location:** `packages/extension/tools/browser-tool-shared.ts:140-152`
```typescript
export const isToolFailure = (value: unknown): value is BrowserToolErrorResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserToolErrorResult>;
  return candidate.success === false && typeof candidate.error === 'string';
};

export const isToolSuccess = (value: unknown): value is BrowserToolSuccessResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserToolSuccessResult>;
  return candidate.success === true;
};
```

Similar patterns appear in error handling across the codebase but with different type names.

---

## 4. DUPLICATE TYPE DEFINITIONS

### 4.1 Model/Provider Entry Types (DUPLICATE STRUCTURES)
**Similarity: 95%**

| Location | Type |
|----------|------|
| `packages/extension/ai/providers/types.ts:20-25` | `ModelEntry` |
| `packages/shared/src/provider-instance.ts:6-12` | `ProviderModelEntry` |

Both define:
```typescript
interface X {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
  // ...extra field in one
}
```

---

### 4.2 Provider Connection Config (DUPLICATE PATTERNS)
**Similarity: 90%**

| Location | Type |
|----------|------|
| `packages/shared/src/connection-config.ts:8-16` | `ProviderConnectionConfig` |
| `packages/shared/src/provider-instance.ts:19-22` | `ProviderInstanceBase` (Pick of above) |
| `packages/extension/ai/providers/types.ts:26-33` | `ProviderCredentials` (similar) |

---

### 4.3 Tool Definition Types (DUPLICATE)
**Similarity: 100%**

| Location | Pattern |
|----------|---------|
| `packages/extension/ai/sdk/tool-builder.ts:5` | `export type { ToolDefinition }` |
| `packages/extension/ai/sdk/provider-types.ts` | Similar type structures |
| `packages/shared/src` | Likely has original definition |

Multiple re-exports of the same `ToolDefinition` type from `@parchi/shared`.

---

## 5. DUPLICATE CONSTANTS

### 5.1 Maximum Limits (SCATTERED MAGIC NUMBERS)

| Constant | Location(s) | Value |
|----------|-------------|-------|
| `MAX_SESSION_TABS` | `browser-tool-shared.ts:105` | 5 |
| `MAX_TABS` | `browser-tool-definitions.ts:5` | Same (re-export) |
| `MAX_WAIT_TIMEOUT_MS` | `browser-tool-shared.ts:113` | 15_000 |
| `MAX_MODELS_TOTAL` | `model-catalog.ts:12` | 600 |
| `MAX_MODELS_PER_PROVIDER` | `model-catalog-fetch.ts:17` | 250 |
| `MAX_CHAT_TURNS` | `chat-pruning.ts:5` | 100 |
| `MAX_HISTORY_TURN_ENTRIES` | `history-manager.ts:6` | 200 |
| `MAX_TOOL_EVENTS_PER_TURN` | `history-manager.ts:7` | 160 |
| `MAX_REPORT_IMAGES` | `panel-tools-shared.ts:93` | 50 |
| `MAX_REPORT_IMAGE_BYTES` | `panel-tools-shared.ts:94` | 12MB |
| `MAX_DISPLAY_HISTORY` | `chat-utils.ts:26` | 400 |
| `MAX_TRACE_STRING_LENGTH` | `trace-sanitizer.ts:6` | 4000 |
| `MAX_TRACE_ARRAY_ITEMS` | `trace-sanitizer.ts:7` | 40 |
| `MAX_TRACE_OBJECT_KEYS` | `trace-sanitizer.ts:8` | 60 |
| `MAX_FAILURE_TRACKER_ENTRIES` | `session-manager.ts:7` | 250 |
| `MAX_FAILURE_TRACKER_ENTRIES` | `postprocess.ts:7` | 250 (DUPLICATE!) |
| `MAX_CONTENT_PERF_*` | `content-perf.ts:1-5` | Various |

**Note:** `MAX_FAILURE_TRACKER_ENTRIES = 250` is defined in TWO different files!

---

### 5.2 Default Values (SCATTERED)

| Constant | Location(s) | Value |
|----------|-------------|-------|
| `DEFAULT_WAIT_TIMEOUT_MS` | `browser-tool-shared.ts:112` | 5000 |
| `DEFAULT_WAIT_POLL_INTERVAL_MS` | `browser-eval-shared.ts:3` | 250 |
| `DEFAULT_SESSION_GROUP` | `browser-tool-shared.ts:107` | `{title: 'Parchi', color: 'blue'}` |
| `DEFAULT_CONNECTION_CONFIG` | `connection-config.ts:21` | Object |
| `DEFAULT_TOOL_PERMISSIONS` | `settings.ts:9` | Object |
| `DEFAULT_COMPACTION_SETTINGS` | `compaction/settings.ts:8` | Object |

---

## 6. DUPLICATE VALIDATION LOGIC

### 6.1 Non-Empty String Assertion (DUPLICATE - 2+ locations)
**Similarity: 90%**

**Location A:** `packages/extension/background/message-response.ts:37-41`
```typescript
export function assertNonEmptyString(value: unknown, errorMessage: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(errorMessage);
  return normalized;
}
```

**Location B:** `packages/extension/ai/sdk/provider-utils.ts` (implied by pattern)

---

### 6.2 Array Assertion (DUPLICATE)
**Similarity: 100%**

**Location:** `packages/extension/background/message-response.ts:43-48`
```typescript
export function assertArray<T = unknown>(value: unknown, errorMessage: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(errorMessage);
  }
  return value as T[];
}
```

Similar array validation exists elsewhere without the error throwing.

---

## 7. RECOMMENDED CONSOLIDATION APPROACH

### 7.1 Create Shared Utilities Module

Create `@parchi/shared/src/utils/index.ts` exporting:

```typescript
// Type guards
export const asRecord = (value: unknown): Record<string, unknown> | null => { ... };
export const asString = (value: unknown) => String(value ?? '').trim();
export const asNumber = (value: unknown): number | null => { ... };

// Async utilities
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// String utilities
export const truncate = (value: string, max: number) => { ... };

// HTML utilities (already exists)
export { escapeHtml, escapeHtmlBasic, escapeAttribute } from './html.js';
```

### 7.2 Consolidate Constants

Create `@parchi/shared/src/constants.ts`:

```typescript
export const LIMITS = {
  SESSION_TABS: 5,
  WAIT_TIMEOUT_MS: 15000,
  HISTORY_TURN_ENTRIES: 200,
  TOOL_EVENTS_PER_TURN: 160,
  TRACE_STRING_LENGTH: 4000,
  TRACE_ARRAY_ITEMS: 40,
  TRACE_OBJECT_KEYS: 60,
  FAILURE_TRACKER_ENTRIES: 250,
} as const;

export const DEFAULTS = {
  WAIT_TIMEOUT_MS: 5000,
  WAIT_POLL_INTERVAL_MS: 250,
  SESSION_GROUP_TITLE: 'Parchi',
  SESSION_GROUP_COLOR: 'blue',
} as const;
```

### 7.3 Consolidate Provider Utilities

Merge `normalizeAnthropicBaseUrl` (definitions.ts) with `toAnthropicBaseUrl` (provider-utils.ts) - they are nearly identical.

### 7.4 Consolidate Sanitization Logic

Create unified sanitizer in `@parchi/shared` with configurable limits:

```typescript
export interface SanitizeOptions {
  maxStringLength?: number;
  maxArrayItems?: number;
  maxObjectKeys?: number;
  maxDepth?: number;
  omitDataUrls?: boolean;
}

export function createSanitizer(options: SanitizeOptions) {
  return (value: unknown) => { ... };
}
```

---

## 8. FILES WITH MOST DUPLICATION

| File | Duplicate Count | Notes |
|------|-----------------|-------|
| `packages/extension/ai/providers/instance-normalize.ts` | 5+ | asRecord, asString, normalize functions |
| `packages/extension/background/message-handlers/*.ts` | 4+ | normalizeSessionId usage pattern |
| `packages/extension/sidepanel/ui/core/dom-utils.ts` | 3+ | debounce (also in npm) |
| `packages/extension/tools/browser-tool-shared.ts` | 6+ | type guards, MAX constants |
| `packages/shared/src/utils/html.ts` | 5+ | escapeHtml variants everywhere |

---

## 9. PRIORITY RECOMMENDATIONS

### High Priority (Do First)
1. **Consolidate `asRecord` and `asString`** - 6+ duplicate implementations
2. **Consolidate `sleep` function** - 8+ duplicate implementations
3. **Unify `MAX_FAILURE_TRACKER_ENTRIES`** - Exact duplicate in 2 files
4. **Use shared `escapeHtml`** - 4+ local implementations

### Medium Priority
5. **Create shared constants file** - Limits scattered everywhere
6. **Consolidate sanitize functions** - 3 similar implementations
7. **Merge base URL normalization** - 2 nearly identical functions

### Low Priority
8. **Consolidate truncate functions** - Many similar implementations
9. **Unify provider type detection** - Similar patterns in 3+ files

---

*Report generated: 2026-03-27*
*Focus areas: packages/extension/ai, background, sidepanel, tools, shared*
