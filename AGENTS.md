# Agent Notes

- Default browser automation runtime is `agent-browser` (`npm run browser:agent`).
- Use Playwright only for the repo's E2E test harnesses unless explicitly requested otherwise.
- The extension is loaded from `dist/`. After UI changes, rebuild with `npm run build` or update the matching files in `dist/`.
- When editing UI code, prefer updating the source files under `sidepanel/` and then rebuilding so `dist/sidepanel/` stays in sync.
- Always run `npm run build` before handing off UI changes.
