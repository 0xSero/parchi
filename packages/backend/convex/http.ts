import { httpRouter } from 'convex/server';
import { aiProxy } from './aiProxy.js';
import { auth } from './auth.js';
import { createOpenRouterCheckout } from './openrouter-checkout.js';
import { provisionOpenRouterKey, recoverOpenRouterKey, regenerateOpenRouterKey } from './openrouter-provisioning.js';
import { stripeWebhook } from './stripe-webhooks.js';

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: '/ai-proxy',
  method: 'POST',
  handler: aiProxy,
});

http.route({
  path: '/ai-proxy',
  method: 'OPTIONS',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/openai/',
  method: 'POST',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/openai/',
  method: 'OPTIONS',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/anthropic/',
  method: 'POST',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/anthropic/',
  method: 'OPTIONS',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/kimi/',
  method: 'POST',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/kimi/',
  method: 'OPTIONS',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/openrouter/',
  method: 'POST',
  handler: aiProxy,
});

http.route({
  pathPrefix: '/ai-proxy/openrouter/',
  method: 'OPTIONS',
  handler: aiProxy,
});

http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: stripeWebhook,
});

http.route({
  path: '/api/checkout',
  method: 'POST',
  handler: createOpenRouterCheckout,
});

http.route({
  path: '/api/checkout',
  method: 'OPTIONS',
  handler: createOpenRouterCheckout,
});

http.route({
  path: '/api/provision',
  method: 'POST',
  handler: provisionOpenRouterKey,
});

http.route({
  path: '/api/provision',
  method: 'OPTIONS',
  handler: provisionOpenRouterKey,
});

http.route({
  path: '/api/regenerate-key',
  method: 'POST',
  handler: regenerateOpenRouterKey,
});

http.route({
  path: '/api/regenerate-key',
  method: 'OPTIONS',
  handler: regenerateOpenRouterKey,
});

http.route({
  path: '/api/recover-key',
  method: 'POST',
  handler: recoverOpenRouterKey,
});

http.route({
  path: '/api/recover-key',
  method: 'OPTIONS',
  handler: recoverOpenRouterKey,
});

http.route({
  path: '/api/stripe/webhook',
  method: 'POST',
  handler: stripeWebhook,
});

export default http;
