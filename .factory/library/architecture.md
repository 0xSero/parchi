# Architecture

Architectural decisions, patterns, and structure discovered during the refactoring mission.

**What belongs here:** Architectural patterns, module organization, key design decisions.
**What does NOT belong here:** Implementation details (put in code comments), operational details (put in AGENTS.md).

---

## Package Structure

```
packages/
├── shared/           # Shared types and utilities (no runtime deps)
├── extension/        # Browser extension (Chrome MV3 / Firefox)
├── backend/          # Convex cloud backend (auth, billing, proxy)
├── cli/              # CLI + relay daemon (merged from relay-service)
├── electron-agent/   # Electron desktop automation agent
└── website/          # Static website + billing pages
```

---

## Key Architectural Patterns

### 1. Message-Based Communication

Extension uses runtime messages between:
- **Sidepanel UI** ↔ **Background Service Worker**

Message types defined in `@parchi/shared/runtime-message-definitions.ts`:
- 21 message variants (streaming, tools, planning, status, etc.)
- Schema versioning for backwards compatibility
- Type guards for safe message handling

### 2. Dependency Injection

Preferred pattern for complex modules:
```typescript
// Good: Dependencies explicit
export function createAgentLoop(deps: {
  messageRouter: MessageRouter;
  toolExecutor: ToolExecutor;
}): AgentLoop { ... }
```

### 3. Factory Functions

Preferred over classes for most use cases:
```typescript
// Good: Factory function
export function createToolExecutor(config: Config): ToolExecutor {
  return {
    execute: (tool) => ...,
    dispose: () => ...
  };
}
```

### 4. Event-Driven Updates

UI updates via message passing:
- Background sends runtime messages
- Sidepanel subscribes and re-renders
- No shared mutable state

---

## Module Organization

### Extension Package

```
extension/
├── background/       # Service worker (agent loop, routing, tools)
│   ├── agent/        # Agent loop implementation
│   ├── tools/        # Tool execution
│   └── relay/        # Relay client
├── sidepanel/        # UI code
│   └── ui/           # Panel components
│       ├── core/     # Base panel infrastructure
│       ├── chat/     # Chat panel
│       ├── settings/ # Settings panels
│       └── ...
├── ai/               # AI/LLM integration
├── tools/            # Browser automation tools
├── state/            # State management
└── utils/            # Utilities
```

### Shared Package

```
shared/src/
├── runtime-message-definitions.ts  # Message types
├── runtime-messages.ts             # Message utilities
├── orchestrator.ts                 # Multi-agent orchestration
├── plan.ts                         # Simple linear plans
├── profile.ts                      # Profile configuration
├── providers.ts                    # Provider instances
├── json-rpc.ts                     # JSON-RPC types
├── tools.ts                        # Tool definitions
└── utils/                          # JSON, HTML utilities
```

---

## Key Interfaces

### RuntimeMessage
```typescript
type RuntimeMessage =
  | AssistantStreamStart
  | AssistantStreamDelta
  | AssistantStreamStop
  | ToolExecutionStart
  | ToolExecutionResult
  | PlanUpdate
  | RunStatus
  | RunError
  | AssistantResponse
  | AssistantFinal
  // ... 21 total variants
```

### ToolDefinition
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: unknown) => Promise<unknown>;
}
```

### ProfileConfig
```typescript
interface ProfileConfig {
  provider: string;
  model: string;
  apiKey?: string;
  customEndpoint?: string;
  extraHeaders?: Record<string, string>;
}
```

---

## Design Decisions

### Why JSON-RPC for Relay?
- Standard protocol with good tooling
- Supports both request/response and notifications
- Easy to implement over WebSocket and HTTP

### Why Separate Packages for CLI and Relay?
- Originally separate for unclear reasons
- **DECISION**: Merge relay-service into cli (reduces duplication)
- Relay daemon is just a CLI feature

### Why Biome over ESLint?
- Faster
- Simpler configuration
- Built-in formatting

### Why esbuild over webpack/rollup?
- Much faster builds
- Simpler configuration
- Good enough for extension bundling

---

## Anti-Patterns to Avoid

1. **God Objects**: Files over 500 lines doing too many things
2. **Implicit Dependencies**: Using globals instead of injection
3. **Deep Nesting**: More than 3 levels of conditionals
4. **Mixed Concerns**: UI logic in business logic files
5. **Duplicate Types**: Same type defined in multiple places
