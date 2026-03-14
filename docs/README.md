# Parchi docs

Start here.

## Read first

- [`agent-pipeline.md`](./agent-pipeline.md) — runtime flow, ownership, and debugging order.
- [`repo-structure.md`](./repo-structure.md) — directory grammar, reusable-pattern rules, and cleanup standard.
- [`tab-process-performance-playbook.md`](./tab-process-performance-playbook.md) — Firefox/Chrome memory and CPU triage.
- [`reports/05-devex-ux-assessment-2026-03-12.md`](./reports/05-devex-ux-assessment-2026-03-12.md) — current developer-experience and user-experience assessment.

## Repo map

| Area | Path |
| --- | --- |
| Extension | `packages/extension/` |
| Shared contracts | `packages/shared/src/` |
| Relay + CLI | `packages/relay-service/`, `packages/cli/` |
| Electron agent | `packages/electron-agent/` |
| Backend | `packages/backend/` |

## Validation

```bash
npm run build
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run check:repo-standards
```

For browser perf work:

```bash
npm run perf:tabs
```
