// AI Proxy Providers - Provider resolution and routing

import type { ProviderTarget } from './ai-proxy-config.js';

export const resolveProviderTarget = (request: Request): ProviderTarget | null => {
  const requestPath = new URL(request.url).pathname;
  if (requestPath.startsWith('/ai-proxy/anthropic')) {
    return {
      provider: 'anthropic',
      upstreamBaseUrl: 'https://api.anthropic.com',
      defaultPath: '/v1/messages',
      upstreamApiKey: String(process.env.ANTHROPIC_API_KEY || '').trim(),
    };
  }
  if (requestPath.startsWith('/ai-proxy/kimi')) {
    return {
      provider: 'kimi',
      upstreamBaseUrl: String(process.env.KIMI_BASE_URL || 'https://api.kimi.com/coding').replace(/\/+$/, ''),
      defaultPath: '/v1/messages',
      upstreamApiKey: String(process.env.KIMI_API_KEY || '').trim(),
    };
  }
  if (requestPath.startsWith('/ai-proxy/openrouter')) {
    return {
      provider: 'openrouter',
      upstreamBaseUrl: 'https://openrouter.ai/api',
      defaultPath: '/v1/chat/completions',
      upstreamApiKey: String(process.env.OPENROUTER_API_KEY || '').trim(),
    };
  }
  if (requestPath.startsWith('/ai-proxy/openai') || requestPath === '/ai-proxy') {
    return {
      provider: 'openai',
      upstreamBaseUrl: 'https://api.openai.com/v1',
      defaultPath: '/chat/completions',
      upstreamApiKey: String(process.env.OPENAI_API_KEY || '').trim(),
    };
  }
  return null;
};

const providerPrefixMap: Record<string, string> = {
  anthropic: '/ai-proxy/anthropic',
  kimi: '/ai-proxy/kimi',
  openrouter: '/ai-proxy/openrouter',
  openai: '/ai-proxy/openai',
};

export const resolveForwardPath = (request: Request, provider: string, defaultPath: string) => {
  const requestPath = new URL(request.url).pathname;
  const prefix = providerPrefixMap[provider] || '/ai-proxy/openai';
  const suffix = requestPath.startsWith(prefix) ? requestPath.slice(prefix.length) : '';
  const forwardPath = suffix || defaultPath;
  if (provider === 'openrouter' && !forwardPath.startsWith('/v1/')) {
    return `/v1${forwardPath.startsWith('/') ? '' : '/'}${forwardPath}`;
  }
  return forwardPath;
};

export const buildUpstreamHeaders = (providerTarget: ProviderTarget, request: Request): Headers => {
  const upstreamHeaders = new Headers({
    'content-type': 'application/json',
  });

  if (providerTarget.provider === 'openai') {
    upstreamHeaders.set('authorization', `Bearer ${providerTarget.upstreamApiKey}`);
  } else if (providerTarget.provider === 'openrouter') {
    upstreamHeaders.set('authorization', `Bearer ${providerTarget.upstreamApiKey}`);
    upstreamHeaders.set('http-referer', 'https://parchi.app');
    upstreamHeaders.set('x-title', 'Parchi');
  } else if (providerTarget.provider === 'anthropic') {
    upstreamHeaders.set('x-api-key', providerTarget.upstreamApiKey);
    upstreamHeaders.set('anthropic-version', request.headers.get('anthropic-version') || '2023-06-01');
  } else {
    upstreamHeaders.set('x-api-key', providerTarget.upstreamApiKey);
    upstreamHeaders.set('anthropic-version', request.headers.get('anthropic-version') || '2023-06-01');
    upstreamHeaders.set('user-agent', 'coding-agent');
  }

  return upstreamHeaders;
};
