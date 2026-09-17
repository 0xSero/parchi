<div align="center">

<img src="packages/extension/icons/icon.svg" alt="Parchi" width="120" height="120" />

# Parchi

**AI-powered browser copilot (Chrome/Firefox extension).**

Chat-driven browser automation in a side panel: navigate, read, click, type, extract, and summarize.

[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Firefox](https://img.shields.io/badge/Firefox-109%2B-FF7139?logo=firefox&logoColor=white)](https://www.mozilla.org/firefox/)
[![License: MIT](https://img.shields.io/badge/License-MIT-a5b4fc.svg)](LICENSE)

</div>

---

## ⚠️ Safety Notice

Browser automation can perform sensitive actions on your behalf.
Use this tool only if you understand and accept the risks:

- automation may violate site terms of service
- prompt-injection can cause unsafe actions
- sensitive information can be exposed if you run untrusted prompts/pages

Always review model output and keep strict tool/domain controls enabled when needed.

---

## 📦 Installation

### Chrome (recommended)

```bash
git clone https://github.com/0xSero/parchi.git
cd parchi
npm install
npm run build
```

Then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/`

### Firefox

```bash
npm run build:firefox
```

Then load the generated extension from `dist-firefox/` in `about:debugging`.

---

## 🔧 Configure a Model

Open the extension settings and configure an OpenAI-compatible provider:

- **OpenAI** `https://api.openai.com/v1`
- **Atlas Cloud** `https://api.atlascloud.ai/v1`
- **Anthropic-compatible**
- **OpenRouter** `https://openrouter.ai/api/v1`
- **Local** (Ollama/LM Studio) `http://localhost:11434/v1`
- any other OpenAI-compatible endpoint

You can set:

- API key
- endpoint/base URL
- model ID
- optional custom headers

---

## ✨ Core Features

- streaming chat + tool execution timeline
- browser tools (navigate, read, interact, tabs, screenshots)
- profile-based model/provider configuration
- orchestrator + subagent flow
- session history and exports
- tool permissions and domain allowlist controls

---

## 🏗 Repo Structure

| Path | Purpose |
|---|---|
| `packages/extension/` | Browser extension runtime + UI + tools |
| `packages/backend/` | Convex backend (auth/billing/proxy) |
| `packages/shared/` | Shared schemas, prompts, runtime types |
| `scripts/` | Build/release/check scripts |
| `tests/` | Unit/integration/e2e/orchestrator/perf harnesses |

---

## 🔨 Development

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run check:repo-standards
```

If you change sidepanel UI code, rebuild and reload the extension from `dist/`.

---

## 📄 License

MIT
