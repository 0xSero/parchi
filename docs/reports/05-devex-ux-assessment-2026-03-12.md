# 05 — DevEx + UX Assessment

**Date:** March 12, 2026  
**Scope:** Current `browser-ai` repo state after refactor/reorg work and E2E expansion

---

## 1) What this records

This is a blunt snapshot of the current developer experience and user experience from the perspective of recent implementation work, reorganization, and end-to-end testing.

It is not a product spec. It is a working assessment of what currently feels strong, what creates drag, and what should be fixed next.

---

## 2) DevEx assessment

### 2.1 What is better than before

- **Directory structure is getting saner**
  - major flat clusters have been moved into subdirectories
  - naming is more consistent
  - feature ownership is easier to trace than it was before

- **The validation ladder is usable**
  - `build`
  - `typecheck`
  - `test:e2e`
  - `check:repo-standards`
  - this is a good baseline loop for fast iteration

- **Repo standards are doing real work**
  - line-limit and changed-file guardrails are helpful
  - they force cleanup pressure instead of letting sprawl silently grow

- **The sidepanel is now testable in meaningful ways**
  - recent E2E work can exercise settings, account, history, theme, tab selection, runtime events, and balance state
  - failures are easier to classify than before

- **Docs direction is improving**
  - `docs/repo-structure.md` gives the repo a directory grammar
  - `docs/agent-pipeline.md` gives a clearer runtime/debugging path

### 2.2 What still hurts

- **Too much behavior still lives in prototype-heavy UI modules**
  - a lot of logic is still trapped behind `SidePanelUI.prototype`
  - this makes reuse and targeted testing harder than it should be
  - it also makes file moves look cleaner than the architecture really is

- **E2E debugging still requires too much repo knowledge**
  - it is better now, but the suite is still custom-script heavy
  - when a test fails, you still need code familiarity to know whether the problem is:
    - selector drift
    - hidden/collapsed UI
    - background runtime failure
    - provider/external failure

- **Background message-path failures are too opaque**
  - the remaining MiniMax/Decomposer smoke failure is a good example
  - “The message port closed before a response was received” is better than `undefined`, but still not enough
  - background test paths need stronger error capture and structured logging

- **Provider routing is easy to misconfigure**
  - MiniMax is Anthropic-compatible in this repo
  - that is not obvious unless you already know the internals
  - provider contract expectations should be visible closer to the test/runtime configuration points

- **Some UI controls are harder to target than they should be**
  - collapsed sections
  - hidden FAB variants
  - mixed visible/invisible affordances
  - this increases both testing friction and product ambiguity

### 2.3 DevEx verdict

The repo is **meaningfully more maintainable than it was**, but it is still not “easy mode.”

The biggest remaining DevEx gap is:

> **architecture clarity is improving faster than operational clarity**

In plain terms:
- folders are better
- runtime/debuggability still needs more work

---

## 3) UX assessment

### 3.1 What feels good

- **The sidepanel has real product density**
  - settings
  - account/billing
  - history
  - runtime status
  - context inspector
  - plan drawer
  - tab selection

- **The visual system is more coherent than generic extension UI**
  - dark neutral palette
  - compact controls
  - relatively strong feature layering

- **The product exposes useful state**
  - status text
  - plan drawer
  - tool rows
  - reasoning stream
  - session token state
  - account/billing indicators

This is good product behavior. Users can see the system doing work.

### 3.2 What still feels rough

- **Some advanced settings are buried inside collapsibles**
  - this keeps the UI compact
  - but it also hides important controls like Look & Feel and relay config
  - discoverability is weaker than it should be

- **There are overlapping action surfaces**
  - quick actions
  - floating action buttons
  - settings/sidebar entry points
  - tab selector state

This makes the UI feel powerful, but slightly over-instrumented.

- **State transitions are not always obvious**
  - opening settings vs account vs history vs tab selector can feel like different UI systems rather than one coherent shell
  - some transitions are clean in code but still feel layered-on in product terms

- **The product still has “operator UI” energy**
  - that is not bad
  - but it means the UX assumes a user who is willing to explore, infer, and recover
  - for less technical users, this will feel dense quickly

### 3.3 UX verdict

The UX is **capable and information-rich**, but not yet fully simplified.

The main UX tension is:

> **the product is powerful enough to justify complexity, but not yet organized enough to make that complexity feel effortless**

---

## 4) Highest-priority improvements

### 4.1 DevEx priorities

1. **Add structured background error reporting for test/runtime message handlers**
   - smoke tests should return explicit provider/runtime failure payloads
   - message-port closure should not be the final error surface

2. **Pull more reusable logic out of `SidePanelUI.prototype` bags**
   - move toward helpers/primitives + thin adapters
   - especially in `ui/core`

3. **Document provider contract expectations where tests use them**
   - especially Anthropic-compatible providers like MiniMax/GLM/Kimi

4. **Keep expanding deterministic E2E coverage before adding more external-path tests**
   - the local UI/runtime suite is becoming valuable
   - protect that

### 4.2 UX priorities

1. **Rationalize action surfaces**
   - reduce overlap between FABs, quick actions, and panel entry points

2. **Make advanced settings more discoverable without dumping everything open**
   - especially Look & Feel and relay sections

3. **Unify right-panel behavior**
   - settings/account/history/tab-selection should feel like one interaction model

4. **Keep status visibility high**
   - the product is strongest when users can see state transitions clearly

---

## 5) Bottom line

### DevEx

**Trend:** improving  
**Current state:** workable, but still high-context  
**Main blocker:** opaque runtime failure surfaces

### UX

**Trend:** strong direction, still dense  
**Current state:** powerful operator-first UI  
**Main blocker:** too many overlapping control surfaces and hidden advanced controls

---

## 6) Recommendation

If the next work is not feature delivery, the best leverage is:

1. **background error-surface hardening**
2. **core primitive extraction**
3. **action-surface simplification in the sidepanel shell**

That combination would improve both DevEx and UX at the same time.
