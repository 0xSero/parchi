# Deep Import/Export Chain Analysis Report

**Generated:** 2026-03-27  
**Scope:** packages/extension/*

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Files Analyzed | 324 |
| Total Exports | 717 |
| Orphaned Modules | 50 |
| Unimported Exports | 261 |
| Test-Only Exports | 0 |
| Suspicious Unused Imports | 1 |
| Barrel Re-export Chains | 122 |
| Single-Implementation Interfaces | 33 |

---

## 1. Orphaned Modules (50 files)

Files that export code but are never imported by any other file (excluding entry points like background.ts, content.ts, panel.ts).

### 1.1 AI Module Orphans

| File | Has Imports | Exports |
|------|-------------|---------|
| `ai/compaction/messages.ts` | ✅ | 3 |
| `ai/compaction/settings.ts` | ❌ | 6 |
| `ai/compaction/tokens.ts` | ✅ | 2 |
| `ai/messages/factory.ts` | ✅ | 4 |
| `ai/models/message-convert.ts` | ✅ | 1 |
| `ai/models/normalize.ts` | ✅ | 5 |
| `ai/providers/instance-migrate.ts` | ✅ | 2 |
| `ai/providers/resolve.ts` | ✅ | 1 |
| `ai/sdk/tool-builder.ts` | ✅ | 2 |

### 1.2 Background Module Orphans

| File | Has Imports | Exports |
|------|-------------|---------|
| `background/agent/compaction/runner.ts` | ✅ | 1 |
| `background/content-perf.ts` | ❌ | 3 |
| `background/tool-permissions.ts` | ✅ | 3 |
| `background/tools/subagent/ai-client.ts` | ✅ | 2 |
| `background/tools/tool-executor/browser-gate.ts` | ✅ | 1 |

### 1.3 Sidepanel Module Orphans

| File | Has Imports | Exports |
|------|-------------|---------|
| `sidepanel/ui/account/account-managed.ts` | ✅ | 1 |
| `sidepanel/ui/chat/trace-store.ts` | ❌ | 1 |
| `sidepanel/ui/core/context-handler.ts` | ✅ | 2 |
| `sidepanel/ui/core/panel-profiles.ts` | ❌ | 5 |
| `sidepanel/ui/status/panel-status.ts` | ❌ | 13 |

### 1.4 Event Handler Orphans (Unused Infrastructure)

All these event handlers are exported but never imported:

- `sidepanel/ui/core/event-handlers/composer.ts`
- `sidepanel/ui/core/event-handlers/index.ts`
- `sidepanel/ui/core/event-handlers/navigation.ts`
- `sidepanel/ui/core/event-handlers/profile.ts`
- `sidepanel/ui/core/event-handlers/runtime.ts`
- `sidepanel/ui/core/event-handlers/settings.ts`
- `sidepanel/ui/core/event-handlers/ui.ts`

### 1.5 Message Handler Orphans

- `sidepanel/ui/core/message-handlers/errors.ts`
- `sidepanel/ui/core/message-handlers/final.ts`
- `sidepanel/ui/core/message-handlers/images.ts`
- `sidepanel/ui/core/message-handlers/plan.ts`
- `sidepanel/ui/core/message-handlers/status.ts`
- `sidepanel/ui/core/message-handlers/stream.ts`
- `sidepanel/ui/core/message-handlers/subagent.ts`
- `sidepanel/ui/core/message-handlers/tokens.ts`
- `sidepanel/ui/core/message-handlers/tools.ts`

### 1.6 Theme Catalog Orphans

All theme catalog files are orphaned:

- `sidepanel/ui/settings/theme-catalog/core-1.ts`
- `sidepanel/ui/settings/theme-catalog/core-2.ts`
- `sidepanel/ui/settings/theme-catalog/extended-a1.ts`
- `sidepanel/ui/settings/theme-catalog/extended-a2.ts`
- `sidepanel/ui/settings/theme-catalog/extended-b1.ts`
- `sidepanel/ui/settings/theme-catalog/extended-b2.ts`
- `sidepanel/ui/settings/theme-catalog/high-contrast-1.ts`
- `sidepanel/ui/settings/theme-catalog/high-contrast-2.ts`

### 1.7 Other Orphans

- `sidepanel/ui/core/message-processor.ts`
- `sidepanel/ui/core/panel-core.ts`
- `sidepanel/ui/core/state-manager.ts`
- `sidepanel/ui/core/watchdog-manager.ts`
- `tools/injected/shared.ts`
- `utils/perf-monitor-bg.ts`
- `utils/perf-monitor.ts`

---

## 2. Most Connected Exports (Top 20)

These exports are imported by the most consumers:

| Rank | Export | File | Consumers | Actually Used |
|------|--------|------|-----------|---------------|
| 1 | `SidePanelUI` | `sidepanel/ui/core/panel-ui.ts` | 93 | ✅ |
| 2 | `ServiceContext` | `background/service-context.ts` | 39 | ✅ |
| 3 | `SessionState` | `background/service-types.ts` | 23 | ✅ |
| 4 | `Message` | `ai/messages/schema.ts` | 20 | ✅ |
| 5 | `RunMeta` | `background/service-types.ts` | 19 | ✅ |
| 6 | `BrowserToolArgs` | `tools/browser-tool-shared.ts` | 14 | ✅ |
| 7 | `ToolExecutionOptions` | `background/tools/tool-executor/shared.ts` | 12 | ✅ |
| 8 | `materializeProfileWithProvider` | `ai/providers/registry.ts` | 11 | ✅ |
| 9 | `ToolExecutionArgs` | `background/tools/tool-executor/shared.ts` | 11 | ✅ |
| 10 | `OAuthProviderKey` | `oauth/types.ts` | 11 | ✅ |
| 11 | `BrowserToolsDelegate` | `tools/browser-tool-shared.ts` | 11 | ✅ |
| 12 | `ThemeDefinition` | `sidepanel/ui/settings/theme-definition.ts` | 10 | ✅ |
| 13 | `missingSessionTabError` | `tools/browser-tool-shared.ts` | 10 | ✅ |
| 14 | `AgentLoopDiagnostics` | `background/agent/agent-loop/shared.ts` | 8 | ✅ |
| 15 | `PreparedAgentLoopRun` | `background/agent/agent-loop/shared.ts` | 8 | ✅ |
| 16 | `normalizeConversationHistory` | `ai/messages/schema.ts` | 7 | ✅ |
| 17 | `RuntimeSendResponse` | `background/message-response.ts` | 7 | ✅ |
| 18 | `respondOk` | `background/message-response.ts` | 7 | ✅ |
| 19 | `BrowserTools` | `tools/browser-tools.ts` | 7 | ✅ |
| 20 | `ensureProviderModel` | `ai/providers/registry.ts` | 6 | ✅ |

---

## 3. Least Connected Exports (Bottom 20, excluding unused)

These exports have only 1 consumer each:

| Export | File |
|--------|------|
| `getSubagentColor` | `subagent-colors.ts` |
| `getSubagentColorStyle` | `subagent-colors.ts` |
| `BrowserDebugManager` | `tools/browser-debug-tools.ts` |
| `DEFAULT_WAIT_POLL_INTERVAL_MS` | `tools/browser-eval-shared.ts` |
| `MIN_WAIT_POLL_INTERVAL_MS` | `tools/browser-eval-shared.ts` |
| `getGroupTitle` | `tools/browser-session-state.ts` |
| `ADVANCED_BROWSER_TOOL_DEFINITIONS` | `tools/browser-tool-definitions-advanced.ts` |
| `getBrowserToolDefinitions` | `tools/browser-tool-definitions.ts` |
| `getBrowserToolMap` | `tools/browser-tool-definitions.ts` |
| `ToolHandlerMap` | `tools/browser-tool-handlers.ts` |
| `createToolHandlers` | `tools/browser-tool-handlers.ts` |
| `ActionOverlayPayload` | `tools/browser-tool-shared.ts` |
| `BrowserNetworkLogEntry` | `tools/browser-tool-shared.ts` |
| `isToolSuccess` | `tools/browser-tool-shared.ts` |
| `injectedClick` | `tools/injected/click.ts` |
| `injectedType` | `tools/injected/type.ts` |
| `injectedCaptureVideoFrame` | `tools/injected/video-frame.ts` |
| `injectedVideoCheck` | `tools/injected/video.ts` |
| `SelectorSpec` | `tools/selector-spec.ts` |
| `parseSelectorSpec` | `tools/selector-spec.ts` |

---

## 4. Import Chain Depth Analysis

Deepest import chains (files with the longest dependency trees):

| Rank | File | Depth |
|------|------|-------|
| 1 | `background.ts` | 14 |
| 2 | `background/service.ts` | 13 |
| 3 | `background/tools/tool-executor/index.ts` | 12 |
| 4 | `background/tools/tool-executor/builtins.ts` | 11 |
| 5 | `background/agent/agent-loop/index.ts` | 10 |
| 6 | `background/agent/compaction/runner.ts` | 10 |
| 7 | `background/tools/tool-executor/subagent.ts` | 10 |
| 8 | `background/agent/agent-loop/prepare.ts` | 9 |
| 9 | `background/agent/agent-loop/response.ts` | 9 |
| 10 | `background/agent/compaction/core.ts` | 9 |
| 11 | `background/tools/tool-executor/orchestrator.ts` | 9 |
| 12 | `sidepanel/panel.ts` | 9 |
| 13 | `background/agent/agent-loop/assembly.ts` | 8 |
| 14 | `background/agent/agent-loop/model-fallback.ts` | 8 |
| 15 | `background/agent/compaction/telemetry.ts` | 8 |
| 16 | `background/message-router.ts` | 8 |
| 17 | `background/tools/orchestrator/dispatch.ts` | 8 |
| 18 | `background/tools/subagent/ai-client.ts` | 8 |
| 19 | `background/tools/tool-executor/subagent-runner.ts` | 8 |
| 20 | `sidepanel/ui/panel-modules.ts` | 8 |

---

## 5. Single-Implementation Interfaces (Fake Abstractions)

These interfaces/types have only one implementation, suggesting unnecessary abstraction:

| Interface | Defined In | Only Implementation |
|-----------|------------|---------------------|
| `CompactionSettings` | `ai/compaction/settings.ts` | Same file (data structure) |
| `MessageMeta` | `ai/messages/types.ts` | `sidepanel/ui/chat/chat-assistant-new.ts` |
| `ProviderMessage` | `ai/messages/types.ts` | `ai/messages/factory.ts` |
| `ProviderDefinition` | `ai/providers/types.ts` | `ai/providers/definitions.ts` |
| `AgentSettings` | `background/agent/agent-loop/shared.ts` | `background/agent/agent-loop/prepare.ts` |
| `AgentProfile` | `background/agent/agent-loop/shared.ts` | `background/agent/agent-loop/profile.ts` |
| `AgentResponseResult` | `background/agent/agent-loop/shared.ts` | `background/agent/agent-loop/response.ts` |
| `NormalizedToolResult` | `background/agent/response-materializer.ts` | Same file |
| `RuntimeFeatureFlags` | `background/browser-compat.ts` | Same file |
| `KimiHeaderSetupResult` | `background/browser-compat.ts` | Same file |
| `RuntimeMessageResponse` | `background/message-response.ts` | Same file |
| `ServiceContext` | `background/service-context.ts` | `background/service.ts` |
| `ReportImage` | `background/service-types.ts` | `background/report-images.ts` |
| `SessionTokenVisibility` | `background/service-types.ts` | `background/session-tokens.ts` |
| `HistoricalSubagent` | `background/service-types.ts` | `background/tools/orchestrator/subagent-tracking.ts` |
| `TelemetryEvent` | `background/telemetry.ts` | Same file |
| `ToolExecutionArgs` | `background/tools/tool-executor/shared.ts` | `background/tools/tool-executor/subagent.ts` |
| `DeviceCodeFlowCallbacks` | `oauth/flow-device-code.ts` | `oauth/manager.ts` |
| `OAuthProviderConfig` | `oauth/types.ts` | `oauth/providers.ts` |
| `OAuthTokenSet` | `oauth/types.ts` | `oauth/flow-auth-code.ts` |
| `RightPanelName` | `sidepanel/ui/core/panel-navigation.ts` | Same file |
| `SettingsSnapshot` | `state/persistence/settings-repository.ts` | Same file |
| `SessionHistoryStoreState` | `state/stores/session-history-store.ts` | Same file |
| `SettingsStoreState` | `state/stores/settings-store.ts` | Same file |
| `SubagentColor` | `subagent-colors.ts` | Same file |
| `BrowserToolName` | `tools/browser-tool-definitions.ts` | `background/tool-permissions.ts` |
| `WaitTimeoutResolution` | `tools/browser-tool-shared.ts` | Same file |
| `BrowserToolErrorResult` | `tools/browser-tool-shared.ts` | Same file |
| `BrowserToolSuccessResult` | `tools/browser-tool-shared.ts` | Same file |
| `InjectedClickResult` | `tools/injected/click.ts` | Same file |
| `InjectedTypeResult` | `tools/injected/type.ts` | Same file |
| `InjectedVideoCheckResult` | `tools/injected/video.ts` | Same file |
| `SelectorSpec` | `tools/selector-spec.ts` | `tools/injected/click.ts` |

---

## 6. Suspicious Imports (Imported but Not Used)

| Export | Defined In | Imported By (but unused) |
|--------|------------|-------------------------|
| `getProviderConfig` | `oauth/manager.ts` | `background/model-profiles.ts` |

---

## 7. Barrel File Analysis

122 re-export chains detected. Key patterns:

### 7.1 Unconsumed Re-exports (0 consumers)

These barrel files re-export items that are never consumed:

- `ai/compaction/index.ts` re-exports:
  - `CompactionSettings` (0 consumers)
  - `applyCompaction` (0 consumers)
  
- `ai/messages/schema.ts` re-exports:
  - `ContentPart` (via types)
  - `MessageMeta` (via types)
  
- `ai/providers/registry.ts` has many re-exports but the actual consumers import directly from source files

### 7.2 Theme Catalog Pattern

All theme catalog files export constants that are consumed through the catalog index, but the individual theme files themselves are orphaned.

---

## 8. Key Findings

### 8.1 Critical Issues

1. **Massive Orphaned Infrastructure**: The event-handlers and message-handlers directories appear to be infrastructure that was never fully wired up. 15+ files in `sidepanel/ui/core/event-handlers/` and `message-handlers/` are completely orphaned.

2. **Theme System Disconnect**: The theme catalog files (core-1, core-2, extended-a/b, high-contrast) are all orphaned. Themes are likely defined but never registered.

3. **AI Module Fragmentation**: The `ai/` module has many orphaned files suggesting incomplete feature implementations:
   - compaction/messages.ts
   - compaction/settings.ts  
   - compaction/tokens.ts
   - messages/factory.ts
   - models/message-convert.ts
   - models/normalize.ts

### 8.2 Architectural Concerns

1. **Deep Import Chains**: `background.ts` has a depth of 14, indicating tight coupling across the system.

2. **Over-abstraction**: 33 interfaces have only one implementation. Many could be inlined or merged with their implementation.

3. **Barrel File Anti-pattern**: 122 re-export chains create indirection without clear benefit.

### 8.3 Recommendations

1. **Clean up orphaned handlers**: Either wire up the event/message handlers or remove them.
2. **Consolidate theme catalog**: Merge orphaned theme files or properly register them.
3. **Inline single-use interfaces**: Reduce the 33 single-implementation interfaces.
4. **Remove dead compaction code**: If compaction feature is incomplete, consider removing or completing it.
5. **Audit barrel files**: Consider direct imports vs re-exports for clarity.

---

## Appendix: Files by Category

### Dead-end Exports (261 total)
Full list available in `deep-import-analysis-report.json`

### Entry Points (Not Considered Orphaned)
- `background.ts`
- `content.ts`
- `sidepanel/panel.ts`
