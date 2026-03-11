# Agent Notes

- Default browser automation runtime is `agent-browser` (`npm run browser:agent`).
- Use Playwright only for the repo's E2E test harnesses unless explicitly requested otherwise.
- The extension is loaded from `dist/`. After UI changes, rebuild with `npm run build` or update the matching files in `dist/`.
- When editing UI code, prefer updating the source files under `sidepanel/` and then rebuilding so `dist/sidepanel/` stays in sync.
- Always run `npm run build` after any UI/CSS/TS changes and verify `dist/` was updated before handing off.
- Run `npm run check:repo-standards` before handoff. This enforces changed-file guardrails (line limits + diff-based checks).
- For Firefox packaging, keep `packages/extension/manifest.firefox.json` `version` in sync with root `package.json` and Chrome manifest. Use `npm run verify:version-sync` when in doubt.
- Pipeline details for agent/LSP guardrails: `docs/agent-pipeline.md`.

## Version Bump Hook

The pre-commit hook automatically bumps the patch version in `package.json` and manifest files. To disable this behavior and make clean commits without version changes:

```bash
# Disable version bump for a single commit
DISABLE_VERSION_BUMP=1 git commit -m "your message"

# Or export for the current shell session
export DISABLE_VERSION_BUMP=1
git commit -m "your message"
```

When disabled, the version files will not be modified or staged during the commit.
