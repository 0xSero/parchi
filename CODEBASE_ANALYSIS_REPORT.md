# Browser-AI Codebase Deep Architecture Analysis

**Date:** 2026-03-27  
**Analyzed by:** Worker Droid Subagent  
**Repository:** /Users/sero/projects/browser-ai  
**Version:** 0.6.0

---

## Executive Summary

This is a comprehensive deep-dive analysis of the Parchi browser automation extension codebase. The project is a sophisticated Chrome/Firefox extension that enables AI-powered browser automation through configurable LLM providers. It features a multi-layered architecture with background service workers, content scripts, sidepanel UI, and external relay/electron agents.

---

## 1. Complete File Inventory

### 1.1 Root Structure
```
browser-ai/
├── packages/
│   ├── extension/          # Main browser extension (550+ files)
│   ├── shared/             # Shared types & utilities (25 files)
│   ├── backend/            # Convex backend (22 files)
│   ├── cli/                # CLI tool (20 files)
│   ├── electron-agent/     # Electron automation agent (15 files)
│   └── website/            # Marketing website
├── scripts/                # Build & tooling scripts (12 files)
├── tests/                  # Test suites (60+ files)
├── docs/                   # Documentation
└── design-system/          # UI design assets
```

### 1.2 Extension Package Breakdown

#### Core Entry Points
| File | Purpose | Bundle Target |
|------|---------|---------------|
| `background.ts` | Service worker entry | `background.js` (ESM) |
| `sidepanel/panel.ts` | Sidepanel UI entry | `sidepanel/panel.js` (ESM) |
| `content.ts` | Content script entry | `content.js` (IIFE) |
| `content-recording.ts` | Recording content script | `content-recording.js` (IIFE) |
| `offscreen/offscreen.ts` | Offscreen document handler | `offscreen/offscreen.js` |

#### Background Service Architecture (`background/`)
```
background/
├── service.ts              # Main BackgroundService class - central hub
├── service-context.ts      # ServiceContext interface definitions
├── service-types.ts        # Type definitions for sessions/runs
├── message-router.ts       # Runtime message routing
├── message-response.ts     # Response serialization
├── session-lifecycle.ts    # Run lifecycle management
├── session-manager.ts      # Session state management
├── session-tokens.ts       # Token usage tracking
├── tool-permissions.ts     # Permission checking
├── telemetry.ts            # Analytics/telemetry
├── subagent-tab-badges.ts  # Tab badge management
├── browser-compat.ts       # Browser compatibility
├── content-perf.ts         # Content script performance
├── smoke-test.ts           # API health checks
├── model-profiles.ts       # Model profile resolution
├── report-images.ts        # Screenshot report management
├── message-handlers/       # Message handler modules
│   ├── core.ts            # Core message handlers
│   ├── tools.ts           # Tool execution handlers
│   ├── run.ts             # Run control handlers
│   ├── recording.ts       # Recording handlers
│   ├── system.ts          # System handlers
│   ├── telemetry.ts       # Telemetry handlers
│   └── test.ts            # Test handlers
├── agent/
│   ├── agent-loop/        # Main agent loop
│   │   ├── index.ts       # Entry point
│   │   ├── prepare.ts     # Run preparation
│   │   ├── execution.ts   # Response handling
│   │   ├── response.ts    # AI response resolution
│   │   ├── model.ts       # Model interaction
│   │   ├── model-selection.ts  # Profile selection
│   │   ├── model-fallback.ts   # Fallback handling
│   │   ├── model-pass.ts       # Multi-pass logic
│   │   ├── assembly.ts         # Message assembly
│   │   ├── profile.ts          # Profile resolution
│   │   ├── diagnostics.ts      # Performance tracking
│   │   ├── context.ts          # Context management
│   │   └── shared.ts           # Shared types
│   ├── compaction/        # Context compaction
│   │   ├── runner.ts
│   │   ├── core.ts
│   │   ├── messages.ts
│   │   ├── telemetry.ts
│   │   └── ...
│   ├── response-materializer.ts
│   └── skill-matcher.ts
├── tools/
│   ├── tool-catalog.ts           # Tool catalog management
│   ├── tool-executor/            # Tool execution engine
│   │   ├── index.ts             # Main executor
│   │   ├── builtins.ts          # Built-in tools (plan, file, subagent)
│   │   ├── browser-gate.ts      # Browser tool validation
│   │   ├── orchestrator.ts      # Orchestrator tools
│   │   ├── orchestrator-test-mode.ts
│   │   ├── postprocess.ts       # Result post-processing
│   │   ├── runtime.ts           # Runtime event emitter
│   │   ├── shared.ts            # Shared types
│   │   ├── subagent.ts          # Subagent spawning
│   │   ├── subagent-runner.ts   # Subagent execution
│   │   ├── subagent-tab.ts      # Subagent tab management
│   │   └── vision.ts            # Vision tool handling
│   ├── orchestrator/
│   │   ├── tool-definitions.ts
│   │   ├── plan-definitions.ts
│   │   ├── subagent-definitions.ts
│   │   ├── dispatch.ts
│   │   ├── subagent-tracking.ts
│   │   ├── task-utils.ts
│   │   └── whiteboard.ts
│   ├── subagent/
│   │   ├── types.ts
│   │   ├── ai-client.ts
│   │   ├── loop-utils.ts
│   │   ├── result-handler.ts
│   │   └── stream-handler.ts
│   └── xml-tool-parser.ts
└── relay/
    ├── relay-handler.ts
    ├── relay-config.ts
    └── relay-rpc.ts
```

#### Sidepanel UI Architecture (`sidepanel/`)
```
sidepanel/
├── panel.ts                    # Entry point
├── panel.html                  # HTML shell
├── panel.css                   # Main styles
├── styles/                     # Modular CSS
│   ├── base.css
│   ├── layout.css
│   ├── chat.css
│   ├── composer.css
│   ├── account.css
│   ├── recording.css
│   ├── tools.css
│   ├── animations.css
│   └── ...
├── templates/                  # HTML templates
│   ├── main.html
│   ├── sidebar-shell.html
│   ├── tab-selector.html
│   └── panels/
│       ├── account.html
│       ├── history.html
│       └── settings-*.html
└── ui/
    ├── panel-modules.ts        # Module imports
    ├── panel-ui.ts             # Main SidePanelUI class (279 lines)
    ├── panel-core.ts           # Core module assembly
    ├── types/
    │   └── panel-types.ts
    ├── core/                   # Core UI modules
    │   ├── panel-elements.ts       # DOM element refs
    │   ├── panel-elements-*.ts     # Specialized element getters
    │   ├── panel-helpers.ts        # UI helpers
    │   ├── panel-navigation.ts     # View navigation
    │   ├── panel-view.ts           # View switching
    │   ├── panel-scroll.ts         # Scroll management
    │   ├── layout-loader.ts        # Template loading
    │   ├── message-processor.ts    # Runtime message routing
    │   ├── context-handler.ts      # Context compaction UI
    │   ├── dom-utils.ts
    │   ├── history-manager.ts
    │   ├── state-manager.ts
    │   ├── watchdog-manager.ts
    │   ├── trace-sanitizer.ts
    │   ├── panel-session-memory.ts
    │   ├── event-handlers/         # Event handler modules
    │   │   ├── index.ts
    │   │   ├── composer.ts
    │   │   ├── navigation.ts
    │   │   ├── profile.ts
    │   │   ├── runtime.ts
    │   │   ├── settings.ts
    │   │   └── ui.ts
    │   └── message-handlers/       # Message handler modules
    │       ├── index.ts
    │       ├── errors.ts
    │       ├── final.ts
    │       ├── images.ts
    │       ├── plan.ts
    │       ├── status.ts
    │       ├── stream.ts
    │       ├── subagent.ts
    │       ├── tokens.ts
    │       └── tools.ts
    ├── account/                # Account management
    │   ├── panel-account.ts
    │   ├── account-auth.ts
    │   ├── account-billing.ts
    │   ├── account-formatters.ts
    │   ├── account-managed.ts
    │   ├── account-mode.ts
    │   ├── account-profile.ts
    │   └── account-setup-state.ts
    ├── agents/                 # Subagent UI
    │   ├── panel-agents.ts
    │   ├── panel-agents-detail.ts
    │   ├── panel-agent-lifecycle.ts
    │   └── panel-agent-nav.ts
    ├── chat/                   # Chat interface
    │   ├── panel-chat.ts
    │   ├── panel-context.ts
    │   ├── panel-export*.ts    # Export functionality
    │   ├── panel-plan.ts
    │   ├── panel-recorder.ts
    │   ├── panel-streaming*.ts
    │   ├── panel-tools*.ts     # Tool display
    │   ├── chat-*.ts           # Chat components
    │   ├── workflows-*.ts      # Workflow handling
    │   ├── markdown-*.ts       # Markdown rendering
    │   ├── recording-to-skill.ts
    │   └── trace-store.ts
    ├── history/                # Session history
    │   ├── panel-history.ts
    │   ├── history-list.ts
    │   ├── history-render.ts
    │   ├── history-persistence.ts
    │   └── history-session-loader.ts
    ├── settings/               # Settings UI
    │   ├── panel-settings.ts
    │   ├── panel-*.ts          # Various settings panels
    │   ├── settings-*.ts       # Settings modules
    │   ├── profile-*.ts        # Profile management
    │   ├── theme-*.ts          # Theme system
    │   ├── usage-store.ts
    │   └── theme-catalog/      # Theme definitions
    │       ├── index.ts
    │       ├── core-*.ts
    │       ├── extended-*.ts
    │       └── high-contrast-*.ts
    ├── status/                 # Status bar
    │   ├── panel-status.ts
    │   ├── status-display.ts
    │   ├── model-*.ts          # Model selection UI
    │   ├── balance-popover.ts
    │   └── panel-usage.ts
    └── tabs/                   # Tab management
        ├── panel-tabs.ts
        ├── tabs-management.ts
        ├── tabs-helpers.ts
        └── tabs-file-ingestion.ts
```

#### AI System (`ai/`)
```
ai/
├── sdk/                        # AI SDK integration
│   ├── index.ts               # Barrel exports
│   ├── provider-resolve.ts    # Provider resolution
│   ├── provider-standard.ts   # Standard providers
│   ├── provider-oauth.ts      # OAuth providers
│   ├── provider-proxy.ts      # Proxy providers
│   ├── provider-types.ts      # Type definitions
│   ├── provider-utils.ts      # Utilities
│   ├── tool-builder.ts        # Tool set builder
│   ├── vision.ts              # Vision/image handling
│   ├── codex-oauth.ts         # Codex OAuth config
│   └── model-normalize.ts     # Model ID normalization
├── providers/                  # Provider system
│   ├── registry.ts            # Barrel exports
│   ├── definitions.ts         # Provider registry (174 lines)
│   ├── types.ts               # Provider types
│   ├── fetch.ts               # Model fetching
│   ├── resolve.ts             # SDK resolution
│   ├── model-listing.ts       # Model listing logic
│   ├── instance-*.ts          # Provider instance mgmt
│   └── instance-registry.ts
├── models/                     # Model handling
│   ├── convert.ts             # Message conversion
│   ├── message-convert.ts     # Message format conversion
│   ├── content-normalize.ts   # Content normalization
│   ├── normalize.ts           # Model ID normalization
│   └── retry-engine.ts        # Retry logic
├── messages/                   # Message handling
│   ├── schema.ts              # Barrel exports
│   ├── types.ts               # Message types
│   ├── factory.ts             # Message creation
│   └── utils.ts               # Message utilities
├── compaction/                 # Context compaction
│   ├── index.ts               # Barrel exports
│   ├── settings.ts            # Compaction settings
│   ├── tokens.ts              # Token estimation
│   ├── messages.ts            # Compaction logic
│   └── ...
└── errors/                     # Error handling
    ├── classifier.ts          # Error classification
    ├── signals.ts             # Signal detection
    ├── categories-auth.ts     # Auth error categories
    └── categories-infra.ts    # Infra error categories
```

#### Browser Tools (`tools/`)
```
tools/
├── browser-tools.ts           # Main BrowserTools class
├── browser-tool-definitions.ts        # Base tool definitions
├── browser-tool-definitions-advanced.ts
├── browser-tool-handlers.ts           # Tool handler map
├── browser-tool-shared.ts             # Shared types/utilities
├── browser-session-state.ts           # Session tab management
├── browser-script-execution.ts        # Script injection
├── browser-element-picker.ts
├── browser-click-tools.ts
├── browser-input-tools.ts
├── browser-native-input-tools.ts
├── browser-tab-tools.ts
├── browser-read-tools.ts
├── browser-wait-tools.ts
├── browser-media-tools.ts
├── browser-debug-tools.ts
├── browser-repl-tools.ts
├── browser-cors-tools.ts
├── browser-eval-shared.ts
├── selector-spec.ts
└── injected/                  # Injected scripts
    ├── shared.ts
    ├── click.ts
    ├── type.ts
    ├── video.ts
    └── video-frame.ts
```

#### State Management (`state/`)
```
state/
├── core/
│   └── store.ts               # Generic store implementation
├── stores/
│   ├── settings-store.ts      # Settings store
│   └── session-history-store.ts
└── persistence/
    ├── settings-repository.ts
    └── session-history-repository.ts
```

### 1.3 Shared Package (`packages/shared/`)
```
shared/src/
├── index.ts                   # Barrel exports
├── runtime-messages.ts        # Runtime message types & guards
├── runtime-message-types.ts   # Message type definitions
├── runtime-types.ts           # Runtime type definitions
├── orchestrator.ts            # Orchestrator exports
├── orchestrator-types.ts      # Orchestrator types
├── plan.ts                    # Plan types
├── plan-builders.ts           # Plan construction
├── settings.ts                # Settings types
├── profile.ts                 # Profile types
├── provider-instance.ts       # Provider instance types
├── prompts.ts                 # Shared prompts
├── usage.ts                   # Usage tracking types
├── connection-config.ts       # Connection config
├── relay-types.ts             # Relay protocol types
├── json-rpc.ts                # JSON-RPC types
├── recording.ts               # Recording types
├── task-status-helpers.ts     # Status utilities
├── validation-helpers.ts      # Validation utilities
└── utils/
    ├── html.ts                # HTML utilities
    └── json.ts                # JSON utilities
```

### 1.4 Backend Package (`packages/backend/convex/`)
```
backend/convex/
├── schema.ts                  # Database schema
├── auth.ts                    # Authentication
├── http.ts                    # HTTP routes
├── aiProxy.ts                 # AI proxy endpoint
├── ai-proxy-*.ts              # Proxy helpers
├── users.ts                   # User management
├── payments.ts                # Payment processing
├── stripe-*.ts                # Stripe integration
├── subscriptions.ts           # Subscription management
└── _generated/                # Generated types
```

### 1.5 CLI Package (`packages/cli/src/`)
```
cli/src/
├── main.ts                    # Entry point
├── auth.ts                    # Token/auth management
├── daemon.ts                  # Daemon process
├── daemon-*.ts                # Daemon modules
├── native-host.ts             # Native messaging
├── electron.ts                # Electron commands
├── relay-protocol.ts          # Relay types
├── relay-commands.ts          # Relay CLI commands
├── rpc-client.ts              # RPC client
└── commands/
    ├── init.ts
    ├── run.ts
    ├── stop.ts
    ├── status.ts
    ├── tools.ts
    └── tool.ts
```

---

## 2. Dependency Graph

### 2.1 Package Dependencies
```
@parchi/extension
├── @parchi/shared (*)        # Shared types/utilities
├── ai                        # AI SDK
├── @ai-sdk/anthropic         # Anthropic provider
├── @ai-sdk/openai            # OpenAI provider
├── @ai-sdk/openai-compatible # Generic OpenAI
└── convex                    # Backend client

@parchi/cli
├── @parchi/shared (*)
└── ws                        # WebSocket

@parchi/electron-agent
├── @parchi/shared (*)
└── ws

@parchi/backend
├── convex
├── @auth/core
├── @convex-dev/auth
└── stripe
```

### 2.2 Module Import Patterns

#### Background Service Import Flow
```
background.ts
└── BackgroundService (service.ts)
    ├── BrowserTools (tools/browser-tools.ts)
    ├── RecordingCoordinator (recording/recording-coordinator.ts)
    ├── RelayBridge (relay/relay-bridge.ts)
    ├── processUserMessage (agent/agent-loop/index.ts)
    ├── executeToolByName (tools/tool-executor/index.ts)
    └── handleMessage (message-router.ts)
```

#### Sidepanel Import Flow
```
sidepanel/panel.ts
├── SidePanelUI (ui/core/panel-ui.ts)
│   ├── settings-store (state/stores/settings-store.ts)
│   └── session-history-store (state/stores/session-history-store.ts)
├── loadPanelLayout (ui/core/layout-loader.ts)
└── panel-modules (ui/panel-modules.ts)
    └── account/*, chat/*, settings/*, etc.
```

#### AI SDK Resolution Flow
```
ai/sdk/provider-resolve.ts
├── resolveAnthropicCompatibleProvider (provider-standard.ts)
├── resolveOpenRouterProvider (provider-standard.ts)
├── resolveCustomProvider (provider-standard.ts)
└── resolveOAuthProvider (provider-oauth.ts)
    └── resolveProxyProvider (provider-proxy.ts)
```

---

## 3. Data Flow Diagrams

### 3.1 User Message Processing Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   SidePanelUI   │────▶│  handleMessage   │────▶│ processUserMsg  │
│  (user sends)   │     │ (message-router) │     │ (agent-loop)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                          ┌───────────────────────────────┼──────────┐
                          │                               │          │
                          ▼                               ▼          ▼
                   ┌──────────────┐            ┌──────────────┐  ┌──────────┐
                   │   prepare    │───────────▶│   resolve    │  │  tools   │
                   │  (profiles)  │            │   response   │  │  (tool   │
                   └──────────────┘            └──────┬───────┘  │ executor)│
                                                      │            └──────────┘
                          ┌───────────────────────────┘
                          │
                          ▼
                   ┌──────────────┐            ┌─────────────────┐
                   │  sendRuntime │───────────▶│   SidePanelUI   │
                   │  (streaming) │            │ (UI updates)    │
                   └──────────────┘            └─────────────────┘
```

### 3.2 Tool Execution Flow
```
┌──────────────────┐
│ executeToolByName│
│ (tool-executor)  │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌─────────────┐
│builtin │  │ browser-gate │
│tools   │  │ (validation) │
└────────┘  └──────┬──────┘
                   │
                   ▼
            ┌──────────────┐
            │ BrowserTools │
            │ (executeTool)│
            └──────┬───────┘
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │click   │ │navigate│ │screensh│
    │tools   │ │tools   │ │ot tools│
    └───┬────┘ └────┬───┘ └───┬────┘
        │           │         │
        └───────────┴─────────┘
                    │
                    ▼
            ┌──────────────┐
            │ content.ts   │
            │ (DOM access) │
            └──────────────┘
```

### 3.3 State Management Flow
```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   chrome.storage │◀───▶│  SettingsStore   │◀───▶│    UI Components │
│    (persist)     │     │  (state/stores)  │     │   (sidepanel)    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                         │
         │                        ▼                         │
         │               ┌──────────────────┐               │
         │               │   createStore    │               │
         │               │  (state/core)    │               │
         │               └──────────────────┘               │
         │                        │                         │
         │                        ▼                         │
         │               ┌──────────────────┐               │
         └──────────────▶│  subscribe/listen│◀──────────────┘
                         │   (callbacks)    │
                         └──────────────────┘
```

### 3.4 Message Passing Architecture
```
sidepanel (UI) ◀────Chrome Runtime────▶ background (service worker)
                                             │
                                             │ (script injection)
                                             ▼
content script (DOM access) ◀──────────▶ browser tab
```

---

## 4. Dead Code Analysis

### 4.1 Knip-Identified Unused Files (9)
| File | Reason | Likely Fix |
|------|--------|------------|
| `background.ts` | Entry point - knip misses manifest refs | Add to knip entry |
| `content*.ts` | Content scripts - loaded by manifest | Add to knip entry |
| `tools/injected/shared.ts` | Used by injected scripts | Add to knip entry |
| `utils/perf-monitor-bg.ts` | Conditionally imported | Add to knip entry |

### 4.2 Unused Exports (161 identified)

#### High-Priority Cleanup Candidates

**CLI Package (34 unused exports):**
- `PARCHI_DIR`, `AUTH_FILE`, `PID_FILE` - Internal constants, should not be exported
- Most daemon helper functions
- Type definitions that should be internal

**Extension - AI Module (12 unused exports):**
- `isLikelyTextGenerationModelId` - oauth/model-candidates.ts
- Error classification types that are internal

**Extension - Sidepanel UI (45 unused exports):**
- `truncate`, `sleep` - utility functions duplicated
- Event handler setup functions
- Message handler functions (used dynamically)

**Extension - Background (28 unused exports):**
- `getMatchedSkills` - tool-catalog.ts
- `extractXmlToolName`, `extractXmlArgs` - xml-tool-parser.ts
- Content perf utilities

### 4.3 Dynamic Imports Missed by Knip

```typescript
// Conditionally loaded - knip cannot detect
if (__PERF_DEBUG__) {
  import('./utils/perf-monitor-bg.js').then(...)
}

// Lazy-loaded themes
const themeModule = await import(`./theme-catalog/${themeId}.js`);

// Dynamic provider resolution
const provider = await import(`./provider-${type}.js`);
```

### 4.4 Feature Flagged Code
- Recording functionality (`content-recording.ts`)
- Performance monitoring (`perf-monitor*.ts`)
- Debug/development tools
- Electron agent features

---

## 5. Architectural Patterns Found

### 5.1 Pattern: Barrel Exports
**Location:** Widespread (`index.ts` files)
**Purpose:** Clean public API surface
```typescript
// ai/sdk/index.ts
export type { SDKModelSettings } from './provider-types.js';
export { resolveLanguageModel } from './provider-resolve.js';
// ...
```

### 5.2 Pattern: Class + Module Augmentation
**Location:** `sidepanel/ui/core/panel-core.ts`
**Purpose:** Split large class across modules
```typescript
// panel-core.ts imports modules that augment SidePanelUI.prototype
import './dom-utils.js';  // Adds methods to prototype
import './history-manager.js';
// ...
```

### 5.3 Pattern: Store + Repository
**Location:** `state/stores/`, `state/persistence/`
**Purpose:** Separation of UI state from persistence
```typescript
// Store: in-memory reactive state
// Repository: chrome.storage interaction
```

### 5.4 Pattern: Tool Handler Map
**Location:** `tools/browser-tool-handlers.ts`
**Purpose:** Dynamic tool dispatch
```typescript
type ToolHandlerMap = Record<BrowserToolName, ToolHandler>;
```

### 5.5 Pattern: Message Router
**Location:** `background/message-router.ts`
**Purpose:** Centralized message handling
```typescript
const HANDLERS: Record<string, Handler> = {
  user_message: handleUserMessage,
  // ...
};
```

### 5.6 Pattern: Service Context
**Location:** `background/service-context.ts`
**Purpose:** Dependency injection for background service
```typescript
interface ServiceContext {
  browserTools: BrowserTools;
  activeRuns: Map<string, ActiveRun>;
  // ...
}
```

### 5.7 Pattern: Strategy Pattern (Providers)
**Location:** `ai/sdk/provider-*.ts`
**Purpose:** Pluggable AI providers
```typescript
resolveLanguageModel(settings) {
  if (isAnthropic(settings)) return resolveAnthropicCompatibleProvider(...);
  if (isOAuth(settings)) return resolveOAuthProvider(...);
  // ...
}
```

---

## 6. Architectural Inconsistencies & Tech Debt

### 6.1 Naming Convention Inconsistencies

| Pattern | Location | Issue |
|---------|----------|-------|
| `camelCase` | `toolHandlers`, `browserTools` | Standard |
| `PascalCase` | `SidePanelUI`, `BrowserTools` | Classes |
| `snake_case` | `run_meta`, `tool_call` | Inconsistent! |
| `SCREAMING_SNAKE` | `MAX_SESSION_TABS` | Constants |

**Problem:** Message types use snake_case (`user_run_start`) but variables mix conventions.
**Recommendation:** Standardize on camelCase for JS/TS, snake_case only in JSON/protocol boundaries.

### 6.2 Import Path Inconsistencies
```typescript
// Absolute path (preferred)
import { X } from '../ai/messages/types.js';

// Relative path (inconsistent depth)
import { X } from '../../../ai/messages/types.js';
```

### 6.3 Error Handling Patterns

**Three different error handling approaches:**
1. Return `{ success: false, error: string }` - Tool results
2. Throw exceptions - Internal errors
3. Send runtime messages - Async errors

### 6.4 File Size Issues

| File | Lines | Concern |
|------|-------|---------|
| `definitions.ts` | 174 | Provider registry - getting long |
| `panel-ui.ts` | 279 | Main UI class - acceptable |
| `browser-tool-definitions.ts` | ~200 | Tool definitions |

### 6.5 Duplicate Functionality

1. **Token estimation:** Both in `ai/compaction/tokens.ts` and `ai/messages/utils.ts`
2. **Profile resolution:** Multiple profile resolution functions across files
3. **Error classification:** Split across multiple files with overlapping concerns

### 6.6 Type Duplication

```typescript
// In shared/src/orchestrator-types.ts
export type OrchestratorTaskStatus = ...

// Similar types in extension/background/tools/orchestrator/
```

### 6.7 Mixed Module Systems
- Main codebase: ES modules (`.js` imports required)
- Content scripts: IIFE format (for browser compatibility)
- Build outputs: ESM + IIFE mixed

### 6.8 Test File Organization
- Tests scattered in `tests/` (root) and `tests/unit/suites/`
- Some test files directly import from source, others from dist
- Inconsistent naming: `*.test.ts` vs `*-test.ts`

---

## 7. Recommendations for Cleanup

### 7.1 High Priority

1. **Consolidate unused exports**
   - Remove 161 unused exports or mark as internal
   - Use `/** @internal */` JSDoc for internal exports

2. **Fix knip configuration**
   ```json
   {
     "entry": [
       "background.ts",
       "sidepanel/panel.ts", 
       "content.ts",
       "content-recording.ts",
       "offscreen/offscreen.ts"
     ]
   }
   ```

3. **Standardize naming conventions**
   - Use camelCase for all JS identifiers
   - Reserve snake_case for JSON/protocol only

### 7.2 Medium Priority

4. **Extract large registries**
   - Split `definitions.ts` provider registry by provider type
   - Split `browser-tool-definitions.ts` by category

5. **Consolidate token estimation**
   - Merge token utilities into single module
   - Create single source of truth

6. **Add barrel exports consistency**
   - All public modules should have `index.ts`
   - Internal modules should not be importable from outside

### 7.3 Low Priority

7. **Test organization**
   - Move all tests to `packages/*/tests/`
   - Standardize test file naming

8. **Documentation**
   - Add JSDoc to public APIs
   - Document architectural patterns

---

## 8. Security Observations

### 8.1 Potential Concerns
1. **Script injection:** Content scripts inject user-provided selectors - needs sanitization
2. **OAuth tokens:** Stored in chrome.storage - review encryption
3. **CORS rules:** `manage_cors_rules` tool modifies declarativeNetRequest

### 8.2 Well-Handled
- API keys stored in extension storage (not localStorage)
- CSP headers in manifest
- Native messaging host validation

---

## 9. Performance Observations

### 9.1 Positive Patterns
- Lazy loading of performance monitoring
- Context compaction to manage token usage
- Session tab limiting (`MAX_SESSION_TABS = 8`)

### 9.2 Potential Issues
- Large dependency on `ai` SDK and provider SDKs
- No code splitting in sidepanel bundle
- All themes loaded upfront in settings

---

## Appendix: File Count by Module

| Module | Files | Primary Language |
|--------|-------|------------------|
| background/ | ~50 | TypeScript |
| sidepanel/ui/ | ~100 | TypeScript |
| ai/ | ~40 | TypeScript |
| tools/ | ~25 | TypeScript |
| state/ | ~8 | TypeScript |
| shared/src/ | ~25 | TypeScript |
| cli/src/ | ~20 | TypeScript |
| tests/ | ~60 | TypeScript |

**Total:** ~550+ source files

---

*Report generated by comprehensive codebase analysis*
