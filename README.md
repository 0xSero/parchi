<div align="center">

<img src="packages/extension/icons/icon.svg" alt="Parchi" width="120" height="120" />

DO NOT SKIP THIS WARNING, DO NOT USE THIS SOFTWARE IF YOU DO NOT READ THIS:

1. BROWSER AUTOMATION CAN PUT YOUR SOCIAL MEDIA ACCOUNTS AT RISK
2. BROWSER AUTOMATION CAN CAN BE AGAINST TERMS OF SERVICE OF MANY WEBSITES 
3. THIS CAN LEAD TO PROMPT INJECTION ATTACKS
4. THIS CAN LEAD TO LEAKING YOUR PERSONAL INFORMATION
5. THIS CAN CAUSE TECHNICAL ISSUES WITH YOUR BROWSER

THIS IS ALL REAL YOU MUST UNDERSTAND THE RISKS OF USING BROWSER AUTOMATION AND TRUSTING AN LLM WITH YOUR BROWSER. 

THIS TOOL WAS BUILT BY AND FOR PEOPLE WHO UNDERSTAND AND ACCEPT THESE RISKS. 

# Parchi

**Your AI-powered browser copilot.**

Chat-driven browser automation that lives in your sidebar. Navigate, read, click, extract — all through natural language.

[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Firefox](https://img.shields.io/badge/Firefox-109%2B-FF7139?logo=firefox&logoColor=white)](https://www.mozilla.org/firefox/)
[![License: MIT](https://img.shields.io/badge/License-MIT-a5b4fc.svg)](LICENSE)

<br />

[Installation](#-installation) · [Setup](#-setup-your-ai-provider) · [Features](#-features) · [Docs](docs/README.md) · [Relay CLI](#-relay-daemon--cli)

</div>

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

1. open `chrome://extensions`
2. enable **Developer mode**
3. click **Load unpacked**
4. select `dist/`
5. pin and open Parchi from the toolbar

### Firefox

```bash
npm run build:firefox
```

1. Open `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on"**
3. Select any file inside the `dist/` folder

> **XPI packaging:** `npm run build:firefox:xpi` outputs `dist-firefox/<extension-name>-<version>.xpi` for distribution. Requires Developer Edition/Nightly or Mozilla add-on signing for release installs.

---

## 🔧 Setup Your AI Provider

Parchi works with any OpenAI-compatible endpoint. Open the **Settings** panel (gear icon) to configure.

### Option A: Direct API Key (BYOK)

Use your own API key from any supported provider:

| Provider | API URL | Example Models |
|----------|---------|----------------|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-5.4`, `gpt-5-nano`, `gpt-5.3-codex` |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-sonnet-4-6`, `claude-opus-4-6` |
| **Kimi** | `https://api.moonshot.cn/v1` | `kimi-for-coding` (recommended) |
| **OpenRouter** | `https://openrouter.ai/api/v1` | Any model on OpenRouter |
| **Local (Ollama, LM Studio)** | `http://localhost:11434/v1` | `qwen`, `mistral`, etc. |
| **Any OpenAI-compatible** | Your endpoint URL | Your model name |

**Steps:**

1. Open **Settings** → select your provider or choose **Custom**
2. Paste your **API Key**
3. Set the **API URL** (auto-filled for known providers)
4. Pick a **Model** from the dropdown (auto-fetched) or type one manually
5. Hit **Save** — start chatting

### Option B: Parchi Account (Proxy Mode)

Sign in with Google or GitHub to use Parchi's hosted proxy. No API keys needed — billing is handled through your Parchi subscription.

1. Open **Settings** → choose **Paid** account mode
2. Sign in via OAuth
3. Select a model and start chatting

---

## 🔑 Use Your Existing AI Subscription

Already paying for **Claude Pro**, **ChatGPT Plus**, **Gemini Advanced**, or another AI subscription? You can route that subscription through Parchi using **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)**.

CLIProxyAPI is an open-source proxy that converts your existing AI subscription access into an OpenAI-compatible API endpoint — no separate API key purchase needed.

### How it works

1. **Install CLIProxyAPI** — follow the [setup guide](https://github.com/router-for-me/CLIProxyAPI)
2. **Authenticate** with your existing provider (Claude, OpenAI, Gemini, etc.) via OAuth
3. **Point Parchi** at the proxy endpoint:
   - Open **Settings** → provider: **Custom**
   - **API URL:** your CLIProxyAPI endpoint (e.g. `http://localhost:PORT/v1`)
   - **API Key:** your proxy token
   - **Model:** the model you want to use
4. **Chat** — requests route through your existing subscription

### Supported subscriptions

| Subscription | What you get |
|--------------|-------------|
| **Claude Pro / Max** | Claude models via your Anthropic account |
| **ChatGPT Plus / Pro** | GPT-4o, o1, etc. via your OpenAI account |
| **Gemini Advanced** | Gemini models via your Google account |
| **Qwen / iFlow** | Additional provider access |

> CLIProxyAPI supports multi-account round-robin, streaming, function calling, and multimodal inputs. See their [documentation](https://help.router-for.me) for full details.

---

## ✨ Features

- **Chat + AI** — streaming answers, reasoning display, profiles, vision support, context compaction, workflow shortcuts
- **Browser tools** — navigate, click, clickAt, type, scroll, screenshot, findHtml, tab management, video helpers, planning, subagents
- **Session tools** — session tabs, floating HUD, saved history, markdown export with tool traces
- **Controls** — tool permissions, allowlists, confirmations, themes, zoom, custom headers

See [`docs/agent-pipeline.md`](docs/agent-pipeline.md) for the runtime shape and [`docs/tab-process-performance-playbook.md`](docs/tab-process-performance-playbook.md) for perf triage.

---

## 🛰 Relay Daemon & CLI

Expose Parchi as a local automation endpoint for scripts and external tools.

```bash
# 1. Build with relay token
PARCHI_RELAY_TOKEN=your-secret npm run build

# 2. Start the daemon
PARCHI_RELAY_TOKEN=your-secret npm run relay:daemon

# 3. Open the extension once — it can auto-pair from localhost /v1/pair.
#    (Manual fallback in Settings → Relay:
#      URL: http://127.0.0.1:17373
#      Token: your-secret)
```

**Safer managed daemon helper (recommended):**

```bash
npm run relay:secure -- start   # generates/stores strong token, loopback-only
npm run relay:secure -- status
npm run relay:secure -- rotate  # rotates token (+ restarts if running)
npm run relay:secure -- stop
```

**CLI commands:**

```bash
export PARCHI_RELAY_TOKEN=your-secret

# List connected agents
npm run relay -- agents

# List available tools
npm run relay -- tools

# Execute a single tool
npm run relay -- tool navigate --args='{"url":"https://example.com"}'

# Run the agent and wait for result
npm run relay -- run "Open example.com and summarize the page"
```

### Electron desktop automation (relay-native + direct CLI)

You can now control Electron apps (Slack, VS Code, Discord, etc.) in two modes:

1. **Relay-native agent** (multi-agent routing through `parchi-relay`)
2. **Direct CLI mode** (`parchi electron ...` passthrough to `agent-browser`)

```bash
# Build binaries
npm run build

# Start relay daemon (terminal A)
PARCHI_RELAY_TOKEN=your-secret npm run relay:daemon

# Start Electron relay agent (terminal B)
PARCHI_RELAY_TOKEN=your-secret npm run electron:agent

# Confirm agents and choose Electron as default when needed
npm run relay -- agents
npm run relay -- default-agent set <electron-agent-id>
npm run relay -- tools
npm run relay -- tool electron.launch --args='{\"app\":\"Slack\",\"port\":9222}'
npm run relay -- tool electron.connect --args='{\"cdpEndpoint\":\"9222\"}'
npm run relay -- tool electron.snapshot --args='{\"interactive\":true}'
```

Managed mode (recommended once relay secure is configured):

```bash
# Reads relay token/url from ~/.parchi/relay-secure.json
npm run electron:secure -- start
npm run electron:secure -- status
npm run electron:secure -- stop
```

Direct mode:

```bash
# Launch app with remote debugging
parchi electron launch "Slack" --port=9222

# Pass any agent-browser command through parchi
parchi electron connect 9222
parchi electron snapshot -i
parchi electron click @e5
```

---

## 🏗 Architecture

High level:

- **Sidepanel UI** renders chat, history, settings, and tool timelines
- **Background worker** runs the agent loop, tool execution, relay handling, and stream updates
- **Shared contracts** define plans, prompts, tools, and runtime-message schemas

**Workspaces:**

| Workspace | Role |
|------|------|
| `packages/backend/` | Convex backend (auth, billing, API proxy) |
| `packages/cli/` | Local CLI entrypoint and daemon client |
| `packages/electron-agent/` | Relay-native Electron desktop automation agent |
| `packages/extension/` | Browser extension runtime, UI, and tools |
| `packages/relay-service/` | Relay daemon + relay protocol CLI |
| `packages/shared/` | Shared plans, prompts, schemas, and message types |
| `packages/website/` | Static website + billing pages |

More detail:

- [`docs/README.md`](docs/README.md)
- [`docs/agent-pipeline.md`](docs/agent-pipeline.md)
- [`docs/tab-process-performance-playbook.md`](docs/tab-process-performance-playbook.md)

---

## 🔨 Development

```bash
npm install                   # install all workspace deps
npm run build                 # build extension + relay + CLI bundles
npm run typecheck             # repo-wide type checking
npm run lint                  # biome linter
npm run lint:fix              # auto-fix lint issues
npm run test:unit             # run unit tests
npm run test:integration      # run headless integration tests
npm run test:e2e              # run browser E2E harness
npm run check:repo-standards  # enforce changed-file guardrails
npm run perf:tabs             # sample Firefox/Chrome tab CPU + RAM
npm run backend:dev           # run Convex dev backend workspace
npm run dev -w @parchi/website  # run website workspace locally
```

After building, reload the extension in `chrome://extensions` to pick up changes.

### Firefox builds

```bash
npm run build:firefox       # build for Firefox → dist/
npm run build:firefox:xpi   # package as .xpi for distribution
```

### Performance leak audits

```bash
TAB_AUDIT_SAMPLES=6 TAB_AUDIT_INTERVAL_MS=10000 npm run perf:tabs
```

The audit now includes **Parchi-attributed Firefox totals** and **RSS/CPU slope** so you can separate overall browser pressure from likely extension pressure.

Use the full workflow in [`docs/tab-process-performance-playbook.md`](docs/tab-process-performance-playbook.md) to run active/idle audits and validate regressions in Firefox + Chrome.

---

## 📊 Chrome vs Firefox

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Tab grouping | ✅ | — |
| Side panel | ✅ Native | Sidebar (adapted) |
| Relay keepalive | ✅ Offscreen doc | — |
| Min version | MV3 | 109.0+ |

---

<div align="center">

**[Parchi](https://github.com/0xSero/parchi)** is MIT licensed.

Built with the [AI SDK](https://sdk.vercel.ai) · Styled with [Warm Paper](https://github.com/0xSero/parchi) design system

</div>
