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

import {
  getOAuthProfileNameForProvider,
  getPreferredRunnableProfileName,
  isRunnableProfileConfig,
  syncOAuthProfiles,
} from './oauth-profiles.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const setHidden = (el: Element | null, hidden: boolean) => el?.classList.toggle('hidden', hidden);

sidePanelProto.renderOAuthProviderGrid = async function renderOAuthProviderGrid() {
  const grid = document.getElementById('oauthProviderGrid');
  if (!grid) return;

  const ui = this as SidePanelUI & Record<string, any>;
  const nextRenderToken = Number(ui.__oauthProviderRenderToken || 0) + 1;
  ui.__oauthProviderRenderToken = nextRenderToken;

  const states = await getAllProviderStates();
  if (ui.__oauthProviderRenderToken !== nextRenderToken) return;
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
    if (ui.__oauthProviderRenderToken !== nextRenderToken) return;
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

    const card = document.createElement('div');
    card.className = `oauth-provider-card${connected ? ' connected' : ''}`;
    card.dataset.provider = config.key;

    let statusHtml = '<span class="oauth-provider-card-status">Not connected</span>';
    if (connected) {
      const emailLine = email ? `<span class="oauth-provider-card-email">${email}</span>` : '';
      const modelList = fetchedModels.length > 0 ? fetchedModels : config.models.map((m) => m.id);
      const modelOptions = modelList
        .map((id: string) => `<option value="${id}"${id === currentModel ? ' selected' : ''}>${id}</option>`)
        .join('');
      statusHtml = `
        ${emailLine}
        <div class="oauth-provider-model-row">
          <select class="oauth-model-select" data-provider="${config.key}">${modelOptions}</select>
        </div>
      `;
    } else if (error) {
      statusHtml = `<span class="oauth-provider-card-status oauth-error">${error}</span>`;
    }

    card.innerHTML = `
      <div class="oauth-provider-card-info">
        <span class="oauth-provider-card-name">${config.name}</span>
        ${statusHtml}
      </div>
      <div class="oauth-provider-card-actions">
        ${
          connected
            ? `<button class="btn btn-disconnect" data-action="disconnect" data-provider="${config.key}">Disconnect</button>`
            : `<button class="btn btn-primary" data-action="connect" data-provider="${config.key}">Connect</button>`
        }
      </div>
    `;
    grid.appendChild(card);
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
    model: normalizedModelId,
    contextLimit: modelInfo?.contextWindow || this.configs[profileName].contextLimit || 200000,
  };
  await this.persistAllSettings?.({ silent: true });
  this.populateModelSelect?.();
  this.updateModelDisplay?.();
  await this.refreshSetupFlowUi?.();
  this.updateStatus(`${providerConfig?.name || key} model set to ${normalizedModelId}`, 'success');
};

sidePanelProto.startOAuthConnect = async function startOAuthConnect(key: OAuthProviderKey) {
  const config = OAUTH_PROVIDERS[key];
  if (!config) return;

  // Update button to show loading
  const card = document.querySelector(`.oauth-provider-card[data-provider="${key}"]`);
  const statusEl = card?.querySelector('.oauth-provider-card-status') as HTMLElement | null;
  const actionsEl = card?.querySelector('.oauth-provider-card-actions') as HTMLElement | null;
  if (statusEl) statusEl.textContent = 'Connecting...';
  if (actionsEl)
    actionsEl.innerHTML = `<button class="btn btn-secondary" data-action="cancel" data-provider="${key}">Cancel</button>`;

  // Re-bind cancel
  actionsEl?.querySelector('button')?.addEventListener('click', () => {
    cancelConnection(key);
    this.renderOAuthProviderGrid();
  });

  try {
    await connectProvider(key, {
      onDeviceCode: (response: DeviceCodeResponse) => {
        this.showDeviceCodePrompt(key, response);
      },
    });

    setHidden(document.getElementById('oauthDeviceCodePrompt'), true);
    this.updateStatus(`${config.name} connected`, 'success');
    await syncOAuthProfiles(this);
    if (!isRunnableProfileConfig(this.configs?.[this.currentConfig])) {
      const preferredRunnableProfileName = getPreferredRunnableProfileName(this.configs);
      if (preferredRunnableProfileName && this.configs?.[preferredRunnableProfileName]) {
        this.setActiveConfig?.(preferredRunnableProfileName, true);
        await this.persistAllSettings?.({ silent: true });
      }
    }
    await this.refreshSetupFlowUi?.();
    await this.renderOAuthProviderGrid();
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
  if (!isRunnableProfileConfig(this.configs?.[this.currentConfig])) {
    const preferredRunnableProfileName = getPreferredRunnableProfileName(this.configs);
    if (preferredRunnableProfileName && this.configs?.[preferredRunnableProfileName]) {
      this.setActiveConfig?.(preferredRunnableProfileName, true);
      await this.persistAllSettings?.({ silent: true });
    }
  }
  await this.refreshSetupFlowUi?.();
  await this.renderOAuthProviderGrid();
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
