export const CODEX_OAUTH_BASE_URL = 'https://chatgpt.com/backend-api/codex';

export function isCodexOAuthProvider(provider: string | undefined | null): boolean {
  return (
    String(provider || '')
      .trim()
      .toLowerCase() === 'codex-oauth'
  );
}

export function buildCodexOAuthProviderOptions(instructions?: string): {
  openai: { store: false; instructions: string };
} {
  const text = String(instructions || '').trim();
  return {
    openai: {
      store: false,
      instructions: text || 'You are a helpful coding assistant.',
    },
  };
}
