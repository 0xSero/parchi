# Shared foundation notes

- `packages/shared/src/runtime-messages.ts` is the main runtime-message entrypoint. It re-exports helpers from `runtime-messages-base.ts`, `runtime-messages-extended.ts`, and `runtime-types.ts`, and the current `RuntimeMessage` union contains 22 variants.
- `packages/shared/src/json-rpc.ts` now owns the `JsonRpcRequest`, `JsonRpcNotification`, `JsonRpcResponse`, and `ToolDefinition` shared types.
- Shared orchestrator code is now split across `orchestrator.ts` (re-export hub), `orchestrator-types.ts`, `task-status-helpers.ts`, `plan-builders.ts`, and `validation-helpers.ts`.
- Shared provider connection types are split across `profile.ts`, `connection-config.ts`, and `provider-instance.ts`.
- `npm run test:unit` executes `tests/unit/run-unit-tests.ts`, which hard-codes the suite list. Extra CLI filters such as `-- --grep ...` are ignored unless the runner itself is changed.
