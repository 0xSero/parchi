# User Testing Guide - Browser-AI Cleanup

## Validation Surfaces

### Surface 1: Build Verification
**Tool:** npm run build
**Cost:** Low (CPU only, ~10 seconds)
**Max Concurrent:** 5

**Procedure:**
```bash
npm run build
```

**Expected Result:** Build exits 0, dist/ folder created with extension files.

---

### Surface 2: Type Checking
**Tool:** npm run typecheck
**Cost:** Low (CPU only, ~15 seconds)
**Max Concurrent:** 3

**Procedure:**
```bash
npm run typecheck
```

**Expected Result:** No type errors (or only pre-existing errors).

---

### Surface 3: Linting
**Tool:** npm run lint
**Cost:** Low (CPU only, ~5 seconds)
**Max Concurrent:** 5

**Procedure:**
```bash
npm run lint
```

**Expected Result:** No lint errors.

---

### Surface 4: Dead Code Detection
**Tool:** npm run knip
**Cost:** Medium (scans all files, ~20 seconds)
**Max Concurrent:** 2

**Procedure:**
```bash
npm run knip
```

**Expected Result:** Reduced count of unused files/exports after cleanup.

---

### Surface 5: Extension Loading (Manual)
**Tool:** Chrome DevTools + chrome://extensions
**Cost:** Medium (requires browser)
**Max Concurrent:** 1

**Procedure:**
1. Open Chrome, navigate to chrome://extensions
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select dist/ folder
5. Extension loads without errors

**Expected Result:** Extension loads, icon appears, no console errors on load.

---

## Isolation Strategy

### Per-Feature Isolation
Each cleanup feature is independent and can be validated separately:

1. **Dead code removal**: Build + typecheck verify no broken imports
2. **Memory leak fixes**: Code review + build verification
3. **Type safety**: Typecheck verification
4. **CSS cleanup**: Build verification + visual inspection

### Cross-Cutting Validation
After each milestone, run full validation:
1. Clean build
2. Full typecheck
3. Lint
4. Extension load test

## Resource Considerations

- Build uses ~2GB RAM temporarily
- Type check uses ~1GB RAM
- Chrome extension loading requires browser instance
- Tests use existing test infrastructure

## Known Limitations

- Extension requires Chrome/Edge for manual testing
- Some tests may have pre-existing failures (document these)
- Full E2E tests require browser automation setup
