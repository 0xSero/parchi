<div align="center">

<img src="packages/extension/icons/icon.svg" alt="Parchi" width="120" height="120" />

# Parchi

AI-powered browser automation as a **Chrome extension**.

[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-a5b4fc.svg)](LICENSE)

[Install](#installation) · [Provider setup](#provider-setup) · [Development](#development) · [Docs](docs/README.md)

</div>

---

## Warning

Browser automation can trigger account, data, and security risks. Only use this project if you understand those risks and are comfortable with automated browser actions.

---

## Installation

```bash
git clone https://github.com/0xSero/parchi.git
cd parchi
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/`

---

## Provider setup

Open **Settings** in the sidepanel and configure one provider profile.

### BYOK

Use your own API key and endpoint (OpenAI, Anthropic, OpenRouter, local OpenAI-compatible APIs, etc.).

### Managed account mode

Sign in and use managed proxy routing from your Parchi account.

---

## Features

- Chat-driven browser automation in sidepanel UI
- Browser tools (navigate, click, type, read, screenshot, tabs, planning)
- Session history and export
- Profiles, permissions, model visibility, themes, and display controls

---

## Architecture

Core workspaces:

- `packages/extension/` — Chrome extension runtime and UI
- `packages/shared/` — shared contracts/types/helpers
- `packages/backend/` — Convex backend

More detail:

- [`docs/README.md`](docs/README.md)
- [`docs/agent-pipeline.md`](docs/agent-pipeline.md)
- [`docs/tab-process-performance-playbook.md`](docs/tab-process-performance-playbook.md)

---

## Development

```bash
npm run build
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run check:repo-standards
```

For packaging and publish flow:

```bash
npm run release
npm run publish
```
