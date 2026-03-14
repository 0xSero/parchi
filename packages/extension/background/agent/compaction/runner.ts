import { normalizeConversationHistory } from '../../../ai/messages/schema.js';
import type { Message } from '../../../ai/messages/schema.js';
import { resolveLanguageModel } from '../../../ai/sdk/index.js';
import { readSettingsSnapshot } from '../../../state/persistence/settings-repository.js';
import {
  hasOwnApiKey,
  injectOAuthTokens,
  refreshConvexProxyAuthSession,
  resolveProfile,
  resolveRuntimeModelProfile,
} from '../../model-profiles.js';
import type { ServiceContext } from '../../service-context.js';
import type { RunMeta } from '../../service-types.js';
import { captureCompaction, captureException } from '../../telemetry.js';
import { runContextCompaction } from './core.js';

export { runContextCompaction } from './core.js';

export async function processContextCompaction(
  ctx: ServiceContext,
  conversationHistory: Message[],
  sessionId: string,
  options?: { source?: string; force?: boolean },
) {
  const runMeta: RunMeta = {
    runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    turnId: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId,
  };
  const source = typeof options?.source === 'string' ? options.source : 'manual';
  const statusPrefix = source === 'manual' ? 'Manual context' : 'Context';

  if (ctx.activeRunIdBySessionId.has(sessionId)) {
    ctx.sendRuntime(runMeta, {
      type: 'compaction_event',
      stage: 'skipped',
      source,
      note: 'Compaction skipped because a run is still active.',
      details: { reason: 'run_active' },
    });
    ctx.sendRuntime(runMeta, {
      type: 'run_warning',
      message: 'Compaction skipped because a run is still active.',
      stage: 'compaction',
      source,
    });
    ctx.sendRuntime(runMeta, {
      type: 'run_status',
      phase: 'stopped',
      attempts: { api: 0, tool: 0, finalize: 0 },
      maxRetries: { api: 0, tool: 0, finalize: 0 },
      note: 'Stop the active run before compacting.',
      stage: 'compaction',
      source,
    });
    return;
  }

  try {
    const settings = await readSettingsSnapshot();
    const activeProfileName = settings.activeConfig || 'default';
    const orchestratorProfileName = settings.orchestratorProfile || activeProfileName;
    const orchestratorEnabled = settings.useOrchestrator === true;

    const activeProfile = resolveProfile(settings, activeProfileName);
    let orchestratorProfile = orchestratorEnabled ? resolveProfile(settings, orchestratorProfileName) : activeProfile;

    if (!hasOwnApiKey(orchestratorProfile)) {
      await refreshConvexProxyAuthSession(settings);
    }

    const runtimeProfileResolution = resolveRuntimeModelProfile(orchestratorProfile, settings);
    if (!runtimeProfileResolution.allowed) {
      ctx.sendRuntime(runMeta, {
        type: 'run_error',
        message: runtimeProfileResolution.errorMessage || 'Please configure your API key in settings',
        stage: 'compaction',
        source,
      });
      return;
    }
    if (runtimeProfileResolution.route === 'oauth') {
      orchestratorProfile = await injectOAuthTokens(runtimeProfileResolution.profile);
    } else {
      orchestratorProfile = runtimeProfileResolution.profile;
    }

    const model = resolveLanguageModel(orchestratorProfile as any);
    const history = normalizeConversationHistory(Array.isArray(conversationHistory) ? conversationHistory : []);
    if (history.length < 1) {
      ctx.sendRuntime(runMeta, {
        type: 'run_warning',
        message: 'Compaction skipped: no conversation history yet.',
        stage: 'compaction',
        source,
      });
      ctx.sendRuntime(runMeta, {
        type: 'run_status',
        phase: 'completed',
        attempts: { api: 0, tool: 0, finalize: 0 },
        maxRetries: { api: 0, tool: 0, finalize: 0 },
        note: 'Compaction skipped (no conversation history yet).',
        stage: 'compaction',
        source,
      });
      return;
    }

    const contextLimit = orchestratorProfile.contextLimit || settings.contextLimit || 200000;
    const result = await runContextCompaction(ctx, {
      runMeta,
      history,
      contextLimit,
      orchestratorProfile,
      model,
      force: options?.force === true,
      source,
      statusPrefix,
    });
    if (!result.compacted) {
      ctx.sendRuntime(runMeta, {
        type: 'run_warning',
        message: result.reason || 'Compaction skipped.',
        stage: 'compaction',
        source,
      });
    }
    ctx.sendRuntime(runMeta, {
      type: 'run_status',
      phase: 'completed',
      attempts: { api: 0, tool: 0, finalize: 0 },
      maxRetries: { api: 0, tool: 0, finalize: 0 },
      note: result.compacted ? 'Context compaction completed.' : result.reason || 'Compaction skipped.',
      stage: 'compaction',
      source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Compaction failed');
    ctx.sendRuntime(runMeta, {
      type: 'compaction_event',
      stage: 'failed',
      source,
      note: `Compaction failed: ${message}`,
      details: { error: message },
    });
    void captureCompaction(
      'failed',
      { error: message },
      { sessionId: runMeta.sessionId, runId: runMeta.runId, turnId: runMeta.turnId },
    );
    void captureException(
      error instanceof Error ? error : new Error(message),
      { stage: 'compaction' },
      { sessionId: runMeta.sessionId, runId: runMeta.runId },
    );
    ctx.sendRuntime(runMeta, {
      type: 'run_error',
      message,
      stage: 'compaction',
      source,
    });
    ctx.sendRuntime(runMeta, {
      type: 'run_status',
      phase: 'failed',
      attempts: { api: 0, tool: 0, finalize: 0 },
      maxRetries: { api: 0, tool: 0, finalize: 0 },
      note: `Compaction failed: ${message}`,
      stage: 'compaction',
      source,
    });
  }
}
