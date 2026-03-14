import { classifyApiError } from '../../../ai/errors/classifier.js';
import { invalidateRuntimeAuthSession } from '../../../convex/client.js';
import { fetchProviderModels } from '../../../oauth/manager.js';
import { refreshConvexProxyAuthSession } from '../../model-profiles.js';
import { runAgentModelPass } from './model-pass.js';
import { inferModelFamily } from './model-selection.js';
import type { AgentLoopDiagnostics, AgentModelPassResult, PreparedAgentLoopRun } from './shared.js';

export async function runAgentModelPassWithFallback(
  prepared: PreparedAgentLoopRun,
  diagnostics: AgentLoopDiagnostics,
): Promise<AgentModelPassResult> {
  let lastModelError: unknown = null;
  let refreshedProxyAuthOnce = false;
  const maxEmptyBodyRetriesPerModel = 2;
  const loadOAuthFallbackCandidates = async (failedModelId: string) => {
    if (!prepared.oauthProviderKey || prepared.oauthFallbackCandidatesLoaded) return 0;
    prepared.oauthFallbackCandidatesLoaded = true;
    try {
      const currentRetrySet = new Set(
        prepared.modelRetryOrder.map((id) =>
          String(id || '')
            .trim()
            .toLowerCase(),
        ),
      );
      let nextCandidates = (await fetchProviderModels(prepared.oauthProviderKey))
        .map((id) => String(id || '').trim())
        .filter((id) => id.length > 0 && !currentRetrySet.has(id.toLowerCase()));

      if (prepared.enforceSameFamilyOAuthFallback) {
        const sameFamilyCandidates = nextCandidates.filter(
          (id) => inferModelFamily(id) === prepared.requestedModelFamily,
        );
        if (sameFamilyCandidates.length > 0) {
          nextCandidates = sameFamilyCandidates;
        } else {
          prepared.ctx.sendRuntime(prepared.runMeta, {
            type: 'run_warning',
            message: `Copilot OAuth rejected "${failedModelId}". No additional ${prepared.requestedModelFamily} fallback models are available for this account.`,
          });
          return 0;
        }
      }

      nextCandidates = nextCandidates.slice(0, 16);
      if (nextCandidates.length > 0) {
        prepared.modelRetryOrder.push(...nextCandidates);
        prepared.ctx.sendRuntime(prepared.runMeta, {
          type: 'run_warning',
          message: `Model "${failedModelId}" unavailable. Loaded ${nextCandidates.length} fallback model candidate(s) from ${prepared.oauthProviderKey} OAuth.`,
        });
      }
      return nextCandidates.length;
    } catch (error) {
      console.warn('[oauth-fallback] Failed to load OAuth fallback model candidates:', error);
      return 0;
    }
  };

  for (let index = 0; index < prepared.modelRetryOrder.length; index += 1) {
    diagnostics.modelAttempts += 1;
    const candidateModelId = prepared.modelRetryOrder[index];
    if (!prepared.switchActiveModel(candidateModelId)) continue;
    if (index > 0) {
      prepared.ctx.sendRuntime(prepared.runMeta, {
        type: 'run_warning',
        message: `Model "${prepared.modelRetryOrder[0]}" unavailable. Retrying with "${candidateModelId}".`,
      });
    }

    let emptyBodyRetries = 0;
    while (true) {
      try {
        const pass = await runAgentModelPass(prepared, diagnostics);
        const hasTextOutput = String(pass.text || '').trim().length > 0;
        const hasToolOutput = Array.isArray(pass.toolResults) && pass.toolResults.length > 0;
        const usageInputTokens = Number(pass.totalUsage?.inputTokens || 0);
        const usageOutputTokens = Number(pass.totalUsage?.outputTokens || 0);
        const looksLikeSilentFailure =
          !hasTextOutput && !hasToolOutput && usageInputTokens === 0 && usageOutputTokens === 0;

        if (looksLikeSilentFailure && prepared.oauthProviderKey) {
          const loadedFallbackCount = await loadOAuthFallbackCandidates(prepared.activeModelId);
          if (index < prepared.modelRetryOrder.length - 1) {
            prepared.ctx.sendRuntime(prepared.runMeta, {
              type: 'run_warning',
              message: `Model "${prepared.activeModelId}" produced no output. Retrying with another ${prepared.oauthProviderKey} model.`,
            });
            lastModelError = new Error(`Model "${prepared.activeModelId}" produced no output.`);
            break;
          }
          if (loadedFallbackCount === 0)
            throw new Error(`Model "${prepared.activeModelId}" is unavailable for this OAuth account.`);
        }

        if (index > 0) await prepared.persistRecoveredModelSelection(candidateModelId);
        return pass;
      } catch (error) {
        const classified = classifyApiError(error, prepared.captureErrorClassificationContext());
        const errorRecord = error && typeof error === 'object' ? (error as Record<string, unknown>) : null;
        const statusCode = Number(errorRecord?.statusCode ?? errorRecord?.status ?? 0);
        const isProxyAuthFailure =
          prepared.runtimeProfileResolution.route === 'proxy' &&
          (classified.category === 'auth' || statusCode === 401 || statusCode === 403);
        if (isProxyAuthFailure && !refreshedProxyAuthOnce) {
          const refreshed = await refreshConvexProxyAuthSession(prepared.settings, { force: true });
          if (refreshed) {
            refreshedProxyAuthOnce = true;
            if (prepared.orchestratorProfile.useProxy) {
              prepared.orchestratorProfile.proxyAuthToken = String(prepared.settings.convexAccessToken || '').trim();
            }
            if (prepared.visionProfile?.useProxy) {
              prepared.visionProfile.proxyAuthToken = String(prepared.settings.convexAccessToken || '').trim();
            }
            prepared.ctx.sendRuntime(prepared.runMeta, {
              type: 'run_warning',
              message: 'Refreshing paid runtime session and retrying request.',
            });
            continue;
          }
          await invalidateRuntimeAuthSession();
          prepared.settings.convexAccessToken = '';
          prepared.settings.convexRefreshToken = '';
          prepared.settings.convexTokenExpiresAt = 0;
        }

        const isEmptyBody = classified.recoverable && classified.message.includes('empty response body');
        if (isEmptyBody && emptyBodyRetries < maxEmptyBodyRetriesPerModel) {
          emptyBodyRetries += 1;
          const waitMs = Math.min(1200, 300 * 2 ** (emptyBodyRetries - 1));
          prepared.ctx.sendRuntime(prepared.runMeta, {
            type: 'run_warning',
            message: `Provider returned an empty response body. Retrying ${emptyBodyRetries}/${maxEmptyBodyRetriesPerModel}...`,
          });
          prepared.ctx.emitTokenTrace(prepared.runMeta, prepared.sessionState, {
            action: 'provider_retry',
            reason: 'provider_retry_empty_body',
            note: `Provider returned an empty response body. Retrying ${emptyBodyRetries}/${maxEmptyBodyRetriesPerModel}.`,
            details: { retry: emptyBodyRetries, retryMax: maxEmptyBodyRetriesPerModel, waitMs },
          });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        if (classified.category === 'model' && prepared.oauthProviderKey) {
          await loadOAuthFallbackCandidates(prepared.activeModelId);
        }
        if (classified.category !== 'model') throw error;
        lastModelError = error;
        break;
      }
    }
  }

  throw lastModelError || new Error('Model unavailable after fallback attempts.');
}
