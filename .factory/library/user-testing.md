# User Testing

Testing surface: tools, URLs, setup steps, and known quirks for manual validation.

**What belongs here:** How to test the application manually, what tools to use, setup requirements.
**What does NOT belong here:** Automated test details (put in test files).

---

## Testing Surfaces

### 1. Browser Extension (Primary)

**How to test:**
1. Build extension: `npm run build`
2. Open Chrome: `chrome://extensions`
3. Enable Developer mode
4. Click "Load unpacked"
5. Select `dist/` directory
6. Pin extension and open sidepanel

**What to test:**
- [ ] Extension loads without errors
- [ ] Sidepanel opens
- [ ] Chat sends messages
- [ ] Agent responds with streaming
- [ ] Tool execution shows in timeline
- [ ] Settings save and persist
- [ ] History shows saved sessions
- [ ] Theme switching works
- [ ] Account login/logout works

**Tools:**
- Chrome DevTools (F12)
- Extension errors: `chrome://extensions` → Errors button
- Console logs: Sidepanel has separate DevTools

### 2. Relay Daemon

**How to test:**
1. Start daemon: `PARCHI_RELAY_TOKEN=test npm run relay:daemon`
2. Verify: `curl http://localhost:3173/v1/health`
3. Connect extension via Settings → Relay

**What to test:**
- [ ] Daemon starts without errors
- [ ] Health endpoint responds
- [ ] Extension connects via WebSocket
- [ ] CLI can call tools via relay
- [ ] Agent runs via relay

**Tools:**
- `curl` for HTTP endpoints
- `wscat` for WebSocket testing (optional)

### 3. CLI

**How to test:**
1. Build: `npm run build`
2. Run: `node dist-cli/parchi.js <command>`

**Commands to test:**
- [ ] `parchi init` - Initialize config
- [ ] `parchi tools` - List available tools
- [ ] `parchi tool <name>` - Execute single tool
- [ ] `parchi run "<prompt>"` - Run agent
- [ ] `parchi daemon start` - Start local daemon

### 4. Backend (Convex)

**How to test:**
1. Deploy: `npm run backend:deploy` (requires Convex account)
2. Or run locally: `npm run backend:dev`

**What to test:**
- [ ] AI proxy forwards requests
- [ ] OAuth flows work
- [ ] Subscription webhooks handled

---

## Testing Tools

### agent-browser

For E2E browser automation:
```bash
npm run browser:agent
```

Used for:
- Automated UI testing
- Screenshot capture
- Form filling
- Navigation testing

### Playwright

For some E2E tests:
```bash
npm run test:e2e
```

Note: Prefer agent-browser for most testing per AGENTS.md.

### curl

For API/relay testing:
```bash
# Health check
curl http://localhost:3173/v1/health

# List agents
curl -H "Authorization: Bearer test" http://localhost:3173/v1/agents

# Call tool
curl -X POST -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"method": "tool.call", "params": {"name": "navigate", "args": {"url": "https://example.com"}}}' \
  http://localhost:3173/v1/rpc
```

---

## Test Accounts

### E2E Provider
- Provider: MiniMax (OpenAI-compatible)
- Base URL: `https://api.minimax.io/v1`
- API Key: Set via `DECOMPOSER_API_KEY` environment variable

### OAuth Testing
- GitHub: Use test account
- Google: Use test account
- Avoid production accounts for testing

---

## Setup Steps for Validation

### Quick Setup
```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Load extension in Chrome
# Open chrome://extensions, load dist/

# 4. Configure provider in Settings
# Set API URL and key

# 5. Test chat
# Send a message, verify response
```

### Full Setup (with relay)
```bash
# 1-5 above, then:

# 6. Start relay daemon
PARCHI_RELAY_TOKEN=test npm run relay:daemon

# 7. Configure extension relay
# Settings → Relay → URL: http://localhost:3173, Token: test

# 8. Test CLI
node dist-cli/parchi.js tools
```

---

## Known Quirks

1. **Sidepanel DevTools**: Separate from page DevTools. Right-click in sidepanel → Inspect.

2. **Hot Reload**: Extension requires manual reload after code changes. Click refresh on `chrome://extensions`.

3. **Service Worker**: Background service worker can go inactive. May need to click extension icon to wake.

4. **CORS**: Direct API calls from extension may hit CORS. Use backend proxy or relay.

5. **Firefox**: Different manifest. Use `npm run build:firefox` and load in `about:debugging`.

---

## Validation Checklist

### Per-Feature
- [ ] Feature works as expected
- [ ] No console errors
- [ ] Settings persist after reload
- [ ] Related features still work

### Per-Milestone
- [ ] All features in milestone work
- [ ] Extension loads fresh
- [ ] All tests pass
- [ ] Coverage meets thresholds

### End-of-Mission
- [ ] Full user flow works end-to-end
- [ ] All panels accessible
- [ ] All settings functional
- [ ] Relay works (if applicable)
- [ ] CLI commands work
