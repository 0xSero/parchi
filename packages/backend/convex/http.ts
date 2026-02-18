import { httpRouter } from 'convex/server';
import { aiProxy } from './aiProxy.js';
import { auth } from './auth.js';
import { stripeWebhook } from './payments.js';

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
  path: '/stripe-webhook',
  method: 'POST',
  handler: stripeWebhook,
});

export default http;
