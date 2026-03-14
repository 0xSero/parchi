# Repo structure and cleanup standard

This repo should use a **consistent directory grammar** across UI, runtime, and backend features.

The goal is not just prettier folders. The goal is:

- reusable patterns
- lower coupling
- fewer flat 10+ file piles
- clearer ownership
- less zombie code after refactors

## Core rules

### 1) Folder owns the namespace

If a feature has enough files to be a real subsystem, give it a directory.

Bad:

```txt
ui/core/
  event-handler-ui.ts
  event-handler-runtime.ts
  event-handler-settings.ts
  message-handler-tools.ts
  message-handler-status.ts
```

Good:

```txt
ui/core/
  event-handlers/
    index.ts
    ui.ts
    runtime.ts
    settings.ts
  message-handlers/
    index.ts
    tools.ts
    status.ts
```

### 2) No repeated prefixes inside a feature folder

Once a directory names the feature, filenames should get shorter.

Bad:

```txt
theme-catalog/
  theme-catalog-core-1.ts
```

Good:

```txt
theme-catalog/
  core-1.ts
```

### 3) `index.ts` is the entrypoint

Every real feature folder should expose a clear entrypoint.

Use `index.ts` for:

- side-effect registration
- barrel exports
- feature composition

### 4) Shared contracts belong in `types.ts`

If a directory has shared contracts across files, add:

```txt
types.ts
```

Do not bury shared feature types in random implementation files.

### 5) Reusable logic belongs in `helpers/`

`helpers/` should contain:

- pure or near-pure utilities
- reusable transforms
- small primitives
- logic that does not require the whole app object

Avoid putting broad app state glue in helpers.

### 6) Integration glue belongs in `adapters/`

`adapters/` is for code that binds primitives to:

- DOM
- browser APIs
- Convex
- Stripe
- `SidePanelUI.prototype`
- other app/runtime boundaries

This keeps reusable logic separate from application wiring.

## Recommended grammar

Use this shape when a folder becomes a real subsystem:

```txt
feature/
  index.ts
  types.ts
  helpers/
  adapters/
```

Then add feature-specific subfolders only when needed:

```txt
feature/
  index.ts
  types.ts
  helpers/
  adapters/
  subfeature-a/
  subfeature-b/
```

## UI-specific guidance

For UI features:

```txt
feature/
  index.ts
  types.ts
  helpers/
  adapters/
  components/
```

Use `components/` only for real UI slices, not as a dumping ground.

## Current direction for sidepanel core

`packages/extension/sidepanel/ui/core/` should keep converging toward:

```txt
core/
  index.ts
  types.ts

  helpers/
    dom.ts
    trace.ts
    history.ts
    scroll.ts
    status.ts

  adapters/
    state.ts
    context.ts
    layout.ts
    watchdog.ts

  panel/
    index.ts
    types.ts
    elements.ts
    view.ts
    navigation.ts
    session-memory.ts

  event-handlers/
    index.ts
    composer.ts
    navigation.ts
    profile.ts
    runtime.ts
    settings.ts
    ui.ts

  message-handlers/
    index.ts
    errors.ts
    final.ts
    images.ts
    plan.ts
    status.ts
    stream.ts
    subagent.ts
    tokens.ts
    tools.ts
```

## Cleanup standard

Refactors are not done until leftovers are removed.

For every directory or architecture change:

1. delete replaced files
2. remove stale imports and exports
3. remove dead UI bindings and storage keys
4. remove obsolete CSS selectors and templates
5. remove dead tests/docs copy
6. avoid compatibility shims unless required
7. rerun gates before handoff

## Completion checklist

Use this checklist when reorganizing a feature:

- [ ] feature has a clear directory owner
- [ ] filenames do not repeat the parent prefix
- [ ] `index.ts` exists where composition/barrel behavior is needed
- [ ] `types.ts` exists if contracts are shared
- [ ] reusable logic moved into helpers instead of app-wide glue
- [ ] adapters contain integration-specific wiring only
- [ ] stale files deleted
- [ ] imports/exports cleaned up
- [ ] validation rerun

## Existing examples in this repo

These already follow the direction better than the old flat layout:

- `packages/extension/background/agent/agent-loop/`
- `packages/extension/background/agent/compaction/`
- `packages/extension/background/tools/tool-executor/`
- `packages/extension/background/tools/orchestrator/`
- `packages/extension/background/tools/subagent/`
- `packages/extension/ai/sdk/`
- `packages/extension/ai/messages/`
- `packages/extension/sidepanel/ui/core/event-handlers/`
- `packages/extension/sidepanel/ui/core/message-handlers/`
- `packages/extension/sidepanel/ui/settings/theme-catalog/`
