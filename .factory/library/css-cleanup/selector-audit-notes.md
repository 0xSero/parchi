# CSS Cleanup Selector Audit Notes

- `message-header` is still an active sidepanel class and must not be treated as dead CSS without removing or changing its renderers first. Current active references include `packages/extension/sidepanel/styles/chat.css`, `packages/extension/sidepanel/ui/chat/chat-assistant-streamed.ts`, `packages/extension/sidepanel/ui/chat/chat-assistant-new.ts`, `packages/extension/sidepanel/ui/chat/chat-display-user.ts`, `packages/extension/sidepanel/ui/history/history-render.ts`, and `packages/extension/sidepanel/ui/agents/panel-agent-nav.ts`.
- For CSS cleanup tasks, verify both stylesheet definitions and source-side class emitters before listing a selector as unused in feature contracts or validation checks.
