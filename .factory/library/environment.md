# Environment

Environment variables, external dependencies, and setup notes for the Parchi refactoring mission.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Required Environment Variables

### For E2E Testing
```bash
DECOMPOSER_PROVIDER=openai-compatible
DECOMPOSER_BASE_URL=https://api.minimax.io/v1
DECOMPOSER_API_KEY=<provided-separately>
```

### For Backend Development
```bash
# Convex deployment (if needed)
CONVEX_DEPLOYMENT=<deployment-name>

# Stripe (for payments testing)
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<secret>
```

### For Publishing (CI/CD only)
```bash
# Chrome Web Store
CWS_EXTENSION_ID=gaaminipkkaiodpoamflodcaiofocmb
CWS_SERVICE_ACCOUNT_KEY=<base64-encoded-json>

# Firefox Add-ons
AMO_JWT_ISSUER=user:19743469
AMO_JWT_SECRET=<secret>
AMO_CHANNEL=listed
```

---

## External Dependencies

### Runtime
- Node.js 18+ (tested with 23.6.0)
- npm or pnpm

### Development
- TypeScript 5.6.3
- esbuild 0.27.2
- Biome 1.9.4
- c8 (coverage)
- Playwright 1.57.0 (for some e2e)
- agent-browser 0.11.1

### Existing Services (do not modify)
- PostgreSQL on localhost:5432
- Redis on localhost:6379

---

## Platform Notes

### macOS
- Default development platform
- Uses Homebrew for Node.js installation
- Chrome/Firefox available for extension testing

### Linux
- Should work but not primary target
- May need different browser paths

### Windows
- Not tested
- Would need path adjustments in scripts

---

## Known Quirks

1. **Biome vs ESLint**: Project uses Biome, not ESLint. Don't install ESLint plugins.

2. **Workspace Dependencies**: Project uses npm workspaces. Always run `npm install` from root.

3. **Build Output**: Extension builds to `dist/`, not `build/`. Load from `dist/` in Chrome.

4. **Firefox Build**: Separate manifest. Use `npm run build:firefox` for Firefox testing.

5. **Coverage Dist**: Coverage tests compile to `.coverage-dist/`. This is expected.

---

## Setup Checklist

- [ ] Node.js 18+ installed
- [ ] `npm install` completed successfully
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes (or documented issues)
- [ ] Extension loads in Chrome from `dist/`
