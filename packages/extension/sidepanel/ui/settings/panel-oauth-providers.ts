import {
  type DeviceCodeResponse,
  OAUTH_PROVIDERS,
  type OAuthProviderKey,
  cancelConnection,
  connectProvider,
  disconnect,
  fetchProviderModels,
  getAllProviderStates,
} from '../../../oauth/manager.js';
import { normalizeOAuthModelIdForProvider } from '../../../oauth/model-normalization.js';
import { SidePanelUI } from '../core/panel-ui.js';

import { ensureProviderModel, getProviderInstance } from '../../../state/provider-registry.js';
import { getOAuthProfileNameForProvider, syncOAuthProfiles } from './oauth-profiles.js';
import { getProviderSvg } from './panel-model-selector.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const setHidden = (el: Element | null, hidden: boolean) => el?.classList.toggle('hidden', hidden);

sidePanelProto.renderOAuthProviderGrid = async function renderOAuthProviderGrid() {
  const grid = document.getElementById('oauthProviderGrid');
  if (!grid) return;

  const states = await getAllProviderStates();
  grid.innerHTML = '';

  // Fetch models from APIs in parallel for connected providers
  const connectedKeys = Object.values(OAUTH_PROVIDERS)
    .filter((c) => {
      const s = states[c.key];
      return Boolean(s?.connected && s?.tokens?.accessToken);
    })
    .map((c) => c.key);
  const modelsByProvider: Record<string, string[]> = {};
  if (connectedKeys.length > 0) {
    const results = await Promise.all(
      connectedKeys.map(async (key) => {
        const models = await fetchProviderModels(key);
        return { key, models };
      }),
    );
    for (const { key, models } of results) {
      modelsByProvider[key] = models;
    }
  }

  for (const config of Object.values(OAUTH_PROVIDERS)) {
    const state = states[config.key];
    const connected = Boolean(state?.connected && state?.tokens?.accessToken);
    const email = state?.email || '';
    const error = state?.error || '';
    const profileName = getOAuthProfileNameForProvider(config.key);
    const profileConfig = this.configs?.[profileName];
    const currentModel = normalizeOAuthModelIdForProvider(config.key, String(profileConfig?.model || ''));
    const fetchedModels = modelsByProvider[config.key] || [];
    const svg = getProviderSvg(config.key);

    const row = document.createElement('div');
    row.className = `provider-row${connected ? ' connected' : ' dim'}`;
    row.dataset.provider = config.key;

    let metaHtml = 'Not connected';
    if (connected) {
      const modelList = fetchedModels.length > 0 ? fetchedModels : config.models.map((m) => m.id);
      const modelOptions = modelList
        .map((id: string) => `<option value="${id}"${id === currentModel ? ' selected' : ''}>${id}</option>`)
        .join('');
      metaHtml = email || 'Connected';
      const selectHtml = `<select class="oauth-model-select" data-provider="${config.key}">${modelOptions}</select>`;
      row.innerHTML = `
        <span class="provider-logo">${svg}</span>
        <div class="provider-info">
          <div class="provider-name">${config.name}</div>
          <div class="provider-meta">${metaHtml}</div>
        </div>
        ${selectHtml}
        <span class="provider-status-dot"></span>
        <button class="connect-btn" data-action="disconnect" data-provider="${config.key}" style="color:var(--muted-dim);border-color:var(--ink-2)">Disconnect</button>
      `;
    } else {
      if (error) metaHtml = error;
      row.innerHTML = `
        <span class="provider-logo">${svg}</span>
        <div class="provider-info">
          <div class="provider-name">${config.name}</div>
          <div class="provider-meta">${metaHtml}</div>
        </div>
        <span class="provider-status-dot off"></span>
        <button class="connect-btn" data-action="connect" data-provider="${config.key}">Connect</button>
      `;
    }
    grid.appendChild(row);
  }

  // Single delegated listener for the grid
  grid.onclick = (e: Event) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button[data-action]') as HTMLElement | null;
    if (btn) {
      const action = btn.dataset.action;
      const provider = btn.dataset.provider as OAuthProviderKey;
      if (!provider) return;
      if (action === 'connect') void this.startOAuthConnect(provider);
      if (action === 'disconnect') void this.startOAuthDisconnect(provider);
      return;
    }
  };

  // Model select change handler
  grid.onchange = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    if (!select.classList.contains('oauth-model-select')) return;
    const providerKey = select.dataset.provider as OAuthProviderKey;
    if (!providerKey) return;
    void this.updateOAuthProfileModel(providerKey, select.value);
  };
};

sidePanelProto.updateOAuthProfileModel = async function updateOAuthProfileModel(
  key: OAuthProviderKey,
  modelId: string,
) {
  const profileName = getOAuthProfileNameForProvider(key);
  if (!this.configs?.[profileName]) return;
  const normalizedModelId = normalizeOAuthModelIdForProvider(key, modelId);
  if (!normalizedModelId) return;

  const providerConfig = OAUTH_PROVIDERS[key];
  const modelInfo = providerConfig?.models.find((m: any) => m.id === normalizedModelId);

  this.configs[profileName] = {
    ...this.configs[profileName],
    modelId: normalizedModelId,
    model: normalizedModelId,
    contextLimit: modelInfo?.contextWindow || this.configs[profileName].contextLimit || 200000,
  };
  const providerId = String(this.configs[profileName]?.providerId || '');
  const providerInstance = getProviderInstance({ providers: this.providers }, providerId);
  if (providerInstance) {
    const nextProvider = ensureProviderModel(providerInstance, {
      id: normalizedModelId,
      label: modelInfo?.label,
      contextWindow: modelInfo?.contextWindow,
      supportsVision: modelInfo?.supportsVision,
    });
    this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };
  }
  await this.persistAllSettings?.({ silent: true });
  this.populateModelSelect?.();
  this.updateModelDisplay?.();
  this.updateStatus(`${providerConfig?.name || key} model set to ${normalizedModelId}`, 'success');
};

sidePanelProto.startOAuthConnect = async function startOAuthConnect(key: OAuthProviderKey) {
  const config = OAUTH_PROVIDERS[key];
  if (!config) return;

  // Update row to show loading
  const row = document.querySelector(`.provider-row[data-provider="${key}"]`);
  const metaEl = row?.querySelector('.provider-meta') as HTMLElement | null;
  if (metaEl) metaEl.textContent = 'Connecting...';
  const connectBtn = row?.querySelector('.connect-btn') as HTMLElement | null;
  if (connectBtn) {
    connectBtn.textContent = 'Cancel';
    connectBtn.dataset.action = 'cancel';
    connectBtn.addEventListener('click', () => {
      cancelConnection(key);
      this.renderOAuthProviderGrid();
    });
  }

  try {
    await connectProvider(key, {
      onDeviceCode: (response: DeviceCodeResponse) => {
        this.showDeviceCodePrompt(key, response);
      },
    });

    setHidden(document.getElementById('oauthDeviceCodePrompt'), true);
    this.updateStatus(`${config.name} connected`, 'success');
    await syncOAuthProfiles(this);
    this.renderOAuthProviderGrid();
  } catch (error) {
    setHidden(document.getElementById('oauthDeviceCodePrompt'), true);
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('cancelled')) {
      this.updateStatus(`${config.name}: ${message}`, 'error');
    }
    this.renderOAuthProviderGrid();
  }
};

sidePanelProto.startOAuthDisconnect = async function startOAuthDisconnect(key: OAuthProviderKey) {
  const config = OAUTH_PROVIDERS[key];
  await disconnect(key);
  this.updateStatus(`${config?.name || key} disconnected`, 'success');
  await syncOAuthProfiles(this);
  this.renderOAuthProviderGrid();
};

sidePanelProto.showDeviceCodePrompt = function showDeviceCodePrompt(
  key: OAuthProviderKey,
  response: DeviceCodeResponse,
) {
  const config = OAUTH_PROVIDERS[key];
  const prompt = document.getElementById('oauthDeviceCodePrompt');
  const nameEl = document.getElementById('oauthDeviceCodeProviderName');
  const codeEl = document.getElementById('oauthDeviceCodeValue');
  const linkEl = document.getElementById('oauthDeviceCodeLink') as HTMLAnchorElement | null;
  const copyBtn = document.getElementById('oauthDeviceCodeCopyBtn');
  const openBtn = document.getElementById('oauthDeviceCodeOpenBtn');
  const cancelBtn = document.getElementById('oauthDeviceCodeCancelBtn');

  if (!prompt) return;

  if (nameEl) nameEl.textContent = config?.name || key;
  if (codeEl) codeEl.textContent = response.user_code;

  const verificationUrl = response.verification_uri_complete || response.verification_uri;
  if (linkEl) {
    linkEl.href = verificationUrl;
    linkEl.textContent = response.verification_uri.replace(/^https?:\/\//, '');
  }

  setHidden(prompt, false);

  // Replace event handlers (remove old, add new)
  const newCopy = copyBtn?.cloneNode(true) as HTMLElement;
  const newOpen = openBtn?.cloneNode(true) as HTMLElement;
  const newCancel = cancelBtn?.cloneNode(true) as HTMLElement;
  copyBtn?.parentNode?.replaceChild(newCopy, copyBtn);
  openBtn?.parentNode?.replaceChild(newOpen, openBtn);
  cancelBtn?.parentNode?.replaceChild(newCancel, cancelBtn);

  newCopy?.addEventListener('click', () => {
    navigator.clipboard.writeText(response.user_code).catch(() => {});
    newCopy.textContent = 'Copied';
    setTimeout(() => {
      newCopy.textContent = 'Copy Code';
    }, 1500);
  });

  newOpen?.addEventListener('click', () => {
    chrome.tabs.create({ url: verificationUrl, active: true }).catch(() => {});
  });

  newCancel?.addEventListener('click', () => {
    cancelConnection(key);
    setHidden(prompt, true);
    this.renderOAuthProviderGrid();
  });
};
