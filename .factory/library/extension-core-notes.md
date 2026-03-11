# Extension core notes

- `npm run check:repo-standards` defaults to `--max-lines=300` unless callers override it; a passing run does **not** by itself prove compliance with the mission's stricter 200-line refactor limit.
- `packages/extension/ai/sdk-client.ts` and `packages/extension/ai/message-schema.ts` are now barrel entrypoints that re-export focused helpers such as `sdk-provider-resolve.ts`, `sdk-tool-builder.ts`, and `message-factory.ts`.
- Provider registry logic now lives under `packages/extension/ai/providers/instance-*.ts`; `packages/extension/ai/providers/registry.ts`, `packages/extension/state/provider-registry.ts`, and `packages/extension/state/provider-models.ts` are compatibility/export hubs rather than the primary implementation files.
