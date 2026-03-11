import type Stripe from 'stripe';
import { type OpenRouterProvisioningPlan, resolveProvisioningSelection } from './openrouter-plan-selection.js';
import {
  assignKeyToGuardrail,
  createManagedOpenRouterKey,
  ensureAllowedModelsGuardrail,
  setManagedOpenRouterKeyDisabled,
} from './openrouterManagement.js';
import { asString, isSubscriptionEnabled, randomHex, sha256Hex } from './stripe-utils.js';

const createRecoveryTokenForSubscription = async (subscriptionId: string) => {
  const secret = randomHex(24);
  const token = `ortk.v1.${subscriptionId}.${secret}`;
  const hash = await sha256Hex(secret);
  return { token, hash };
};

export const parseRecoveryToken = (token: string) => {
  const normalized = asString(token);
  const parts = normalized.split('.');
  if (parts.length !== 4 || parts[0] !== 'ortk' || parts[1] !== 'v1') {
    throw new Error('Invalid recovery token format');
  }

  const subscriptionId = asString(parts[2]);
  const secret = asString(parts[3]);
  if (!subscriptionId.startsWith('sub_') || !secret) {
    throw new Error('Invalid recovery token payload');
  }
  return { subscriptionId, secret };
};

export const resolvePaidProvisioningSession = async (stripe: Stripe, sessionId: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paymentStatus = String(session.payment_status || '').toLowerCase();
  const status = String(session.status || '').toLowerCase();
  const isPaid = paymentStatus === 'paid' || status === 'complete';

  if (!isPaid) {
    throw new Error('Checkout session not paid');
  }
  if (session.mode !== 'subscription') {
    throw new Error('Expected subscription checkout session');
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id || '';
  if (!subscriptionId) {
    throw new Error('Missing subscription on checkout session');
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return { session, subscription };
};

type IssueKeyResult =
  | { alreadyProvisionedHash: string }
  | {
      createdKey: { hash: string; key: string; label: string };
      plan: OpenRouterProvisioningPlan;
      model: string;
      replacedKeyHash: string;
      recoveryToken: string;
    };

export const issueOpenRouterKeyForSubscription = async (args: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  session: Stripe.Checkout.Session | null;
  allowReplace: boolean;
}): Promise<IssueKeyResult> => {
  const { stripe, session, allowReplace } = args;
  let subscription = args.subscription;
  const existingHash = asString(subscription.metadata?.openrouter_key_hash);
  if (!allowReplace && existingHash) {
    return { alreadyProvisionedHash: existingHash };
  }

  if (!isSubscriptionEnabled(subscription.status)) {
    throw new Error('Subscription is not active. Reactivate billing, then retry key issuance.');
  }

  const { runtime, plan, model } = resolveProvisioningSelection(subscription, session);
  const createdKey = await createManagedOpenRouterKey({
    name: `parchi-sub-${subscription.id}`,
    limitUsd: plan.keyLimitUsd,
    limitReset: plan.limitReset,
  });
  const recovery = await createRecoveryTokenForSubscription(subscription.id);

  let guardrailId = '';
  try {
    if (runtime.enforceModelGuardrail && plan.allowedModels.length > 0) {
      guardrailId = await ensureAllowedModelsGuardrail({
        planId: plan.id,
        allowedModels: plan.allowedModels,
        enforceZdr: runtime.enforceZdr,
      });
      await assignKeyToGuardrail(guardrailId, createdKey.hash);
    }

    subscription = await stripe.subscriptions.retrieve(subscription.id);
    const refreshedExistingHash = asString(subscription.metadata?.openrouter_key_hash);
    if (!allowReplace && refreshedExistingHash) {
      await setManagedOpenRouterKeyDisabled(createdKey.hash, true).catch(() => {});
      return { alreadyProvisionedHash: refreshedExistingHash };
    }

    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...subscription.metadata,
        parchi_plan_id: plan.id,
        parchi_model: model,
        parchi_allowed_models: plan.allowedModels.join(','),
        parchi_key_limit_usd: String(plan.keyLimitUsd),
        parchi_limit_reset: plan.limitReset ?? '',
        openrouter_key_hash: createdKey.hash,
        openrouter_key_label: createdKey.label || '',
        openrouter_guardrail_id: guardrailId,
        openrouter_model: model,
        openrouter_previous_key_hash: allowReplace ? refreshedExistingHash : '',
        openrouter_recovery_hash: recovery.hash,
      },
    });

    if (!isSubscriptionEnabled(subscription.status)) {
      await setManagedOpenRouterKeyDisabled(createdKey.hash, true);
    }

    if (allowReplace && refreshedExistingHash && refreshedExistingHash !== createdKey.hash) {
      await setManagedOpenRouterKeyDisabled(refreshedExistingHash, true).catch(() => {});
    }

    return {
      createdKey,
      plan,
      model,
      replacedKeyHash: allowReplace ? refreshedExistingHash : '',
      recoveryToken: recovery.token,
    };
  } catch (error) {
    await setManagedOpenRouterKeyDisabled(createdKey.hash, true).catch(() => {});
    throw error;
  }
};
