# Browser-AI Architecture

## Overview
Parchi is a Chrome/Firefox extension for AI-powered browser automation. It consists of:

- **Background Service Worker**: Orchestrates AI calls, tool execution, session management
- **Sidepanel UI**: User interface for chat, settings, history
- **Content Scripts**: DOM access for browser automation tools
- **Shared Package**: Types and utilities shared across packages

## Key Components

### Background Service (`background/`)
- `service.ts`: Main BackgroundService class, central hub
- `agent/agent-loop/`: AI conversation handling
- `tools/`: Browser automation tool execution
- `session-*.ts`: Session lifecycle and state management

### Sidepanel UI (`sidepanel/`)
- `ui/core/panel-ui.ts`: Main SidePanelUI class
- `ui/chat/`: Chat interface components
- `ui/settings/`: Settings panels
- `styles/`: CSS files

### Content Scripts
- `content.ts`: Main content script for DOM interaction
- `content-recording.ts`: Recording functionality
- `tools/injected/`: Scripts injected into page context

### AI Module (`ai/`)
- `sdk/`: AI SDK integration (provider resolution)
- `providers/`: Provider registry and management
- `compaction/`: Context window compaction

### State Management (`state/`)
- `stores/`: Reactive stores for UI state
- `persistence/`: chrome.storage integration

## Data Flow

1. User sends message in Sidepanel UI
2. Message sent to Background via chrome.runtime
3. Background processes through Agent Loop
4. AI provider called with tools
5. Tool execution dispatched to BrowserTools
6. Content scripts execute DOM operations
7. Results streamed back to Sidepanel UI

## Key Patterns

- **Barrel Exports**: Clean APIs via index.ts files
- **Prototype Augmentation**: SidePanelUI methods added via modules
- **Store + Repository**: UI state separated from persistence
- **Service Context**: Dependency injection for background

## Known Issues

- 50+ orphaned files (never imported)
- 33 single-implementation interfaces
- 1 circular dependency (subagent-runner ↔ ai-client)
- Deep import chains (14 levels in background.ts)
- Memory leaks in content scripts
- 27 empty catch blocks
