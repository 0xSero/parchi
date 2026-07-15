import { buildProviderInstanceId } from '../../../packages/extension/ai/providers/instance-id.js';
import { computeConfiguredContextLimit } from '../../../packages/extension/sidepanel/ui/chat/panel-context.js';
import { syncOAuthProfiles } from '../../../packages/extension/sidepanel/ui/settings/oauth-profiles.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runOauthProfileContextSyncSuite(runner: TestRunner) {
  log('\n=== Testing syncOAuthProfiles contextLimit resolution (xAI / Grok) ===', 'info');

  await runner.test('syncOAuthProfiles is loaded and callable (covers sync module for api context path)', () => {
    runner.assertTrue(typeof syncOAuthProfiles === 'function');
  });

  await runner.test(
    'syncOAuthProfiles with mocked api data sets contextLimit for a brand-new profile from apiModelEntries (not static 256k)',
    async () => {
      const origFetch = (globalThis as any).fetch;
      const origChrome = (globalThis as any).chrome;

      (globalThis as any).fetch = async () =>
        ({
          ok: true,
          json: async () => ({ data: [{ id: 'grok-4', context_length: 128000 }] }),
        }) as any;

      (globalThis as any).chrome = {
        storage: {
          local: {
            get: async (k: any) => {
              const s = typeof k === 'string' ? k : JSON.stringify(k);
              if (s.includes('oauthProviders')) {
                return { oauthProviders: { xai: { connected: true, tokens: { accessToken: 'tok' } } } };
              }
              return {};
            },
            set: async () => {},
          },
        },
        runtime: {},
      } as any;

      const ui: any = {
        configs: {},
        providers: {},
        getDefaultSystemPrompt: () => '',
        persistAllSettings: async () => {},
        refreshConfigDropdown: () => {},
        populateModelSelect: () => {},
        renderModelSelectorGrid: () => {},
        updateModelDisplay: () => {},
        currentConfig: 'default',
      };

      await syncOAuthProfiles(ui);

      const prof = ui.configs['oauth:xai'] || {};
      const prov = (Object.values(ui.providers || {}).find((p: any) => p && p.oauthProviderKey === 'xai') as any) || {};
      const testM = (prov.models || []).find((m: any) => m.id === 'grok-4');

      runner.assertEqual(prof.contextLimit, 128000);
      runner.assertEqual(testM?.contextWindow, 128000);
      runner.assertEqual(prof.model, 'grok-4');

      const comp = computeConfiguredContextLimit(prof);
      runner.assertEqual(comp, 128000);

      (globalThis as any).fetch = origFetch;
      (globalThis as any).chrome = origChrome;
    },
  );

  await runner.test('syncOAuthProfiles preserves a user-customized contextLimit on re-sync (same model)', async () => {
    // Regression guard: OAuth sync must never silently overwrite a contextLimit the
    // user already set, even when live API data for the same model disagrees.
    const origFetch = (globalThis as any).fetch;
    const origChrome = (globalThis as any).chrome;

    (globalThis as any).fetch = async () =>
      ({
        ok: true,
        json: async () => ({ data: [{ id: 'grok-4', context_length: 128000 }] }),
      }) as any;

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: async (k: any) => {
            const s = typeof k === 'string' ? k : JSON.stringify(k);
            if (s.includes('oauthProviders')) {
              return { oauthProviders: { xai: { connected: true, tokens: { accessToken: 'tok' } } } };
            }
            return {};
          },
          set: async () => {},
        },
      },
      runtime: {},
    } as any;

    const providerId = buildProviderInstanceId({
      provider: 'xai-oauth',
      authType: 'oauth',
      oauthProviderKey: 'xai',
      name: 'Grok',
    });
    const ui: any = {
      configs: {
        'oauth:xai': {
          providerId,
          model: 'grok-4',
          modelId: 'grok-4',
          contextLimit: 40000, // deliberate user customization, smaller than any known/live value
          provider: 'xai-oauth',
        },
      },
      providers: {
        [providerId]: {
          id: providerId,
          name: 'Grok',
          oauthProviderKey: 'xai',
          models: [{ id: 'grok-4', contextWindow: 256000 }],
          isConnected: true,
        },
      },
      getDefaultSystemPrompt: () => '',
      persistAllSettings: async () => {},
      refreshConfigDropdown: () => {},
      populateModelSelect: () => {},
      renderModelSelectorGrid: () => {},
      updateModelDisplay: () => {},
      currentConfig: 'oauth:xai',
    };

    await syncOAuthProfiles(ui);

    const prof = ui.configs['oauth:xai'] || {};
    runner.assertEqual(prof.contextLimit, 40000);

    // the provider's model catalog is still refreshed from live data...
    const prov = (Object.values(ui.providers || {}).find((p: any) => p && p.oauthProviderKey === 'xai') as any) || {};
    const modelInProv = (prov.models || []).find((m: any) => m.id === 'grok-4');
    runner.assertEqual(modelInProv?.contextWindow, 128000);

    // ...but the user's profile-level override is left untouched.
    const comp = computeConfiguredContextLimit(prof);
    runner.assertEqual(comp, 40000);

    (globalThis as any).fetch = origFetch;
    (globalThis as any).chrome = origChrome;
  });

  await runner.test(
    'syncOAuthProfiles backfills a missing contextLimit from live api data when the model is unchanged',
    async () => {
      const origFetch = (globalThis as any).fetch;
      const origChrome = (globalThis as any).chrome;

      (globalThis as any).fetch = async () =>
        ({
          ok: true,
          json: async () => ({ data: [{ id: 'grok-4', context_length: 128000 }] }),
        }) as any;

      (globalThis as any).chrome = {
        storage: {
          local: {
            get: async (k: any) => {
              const s = typeof k === 'string' ? k : JSON.stringify(k);
              if (s.includes('oauthProviders')) {
                return { oauthProviders: { xai: { connected: true, tokens: { accessToken: 'tok' } } } };
              }
              return {};
            },
            set: async () => {},
          },
        },
        runtime: {},
      } as any;

      const providerId = buildProviderInstanceId({
        provider: 'xai-oauth',
        authType: 'oauth',
        oauthProviderKey: 'xai',
        name: 'Grok',
      });
      const ui: any = {
        configs: {
          'oauth:xai': {
            providerId,
            model: 'grok-4',
            modelId: 'grok-4',
            contextLimit: 0, // never set
            provider: 'xai-oauth',
          },
        },
        providers: {
          [providerId]: {
            id: providerId,
            name: 'Grok',
            oauthProviderKey: 'xai',
            models: [{ id: 'grok-4', contextWindow: 256000 }],
            isConnected: true,
          },
        },
        getDefaultSystemPrompt: () => '',
        persistAllSettings: async () => {},
        refreshConfigDropdown: () => {},
        populateModelSelect: () => {},
        renderModelSelectorGrid: () => {},
        updateModelDisplay: () => {},
        currentConfig: 'oauth:xai',
      };

      await syncOAuthProfiles(ui);

      const prof = ui.configs['oauth:xai'] || {};
      runner.assertEqual(prof.contextLimit, 128000);

      (globalThis as any).fetch = origFetch;
      (globalThis as any).chrome = origChrome;
    },
  );
}
