export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  jitter?: number;
  rng?: () => number;
};

const DEFAULT_QUIT_PHRASES = [
  'please try again',
  'i could not produce a final summary',
  'i could not produce a final response',
  'unable to produce a final summary',
  'unable to provide a final response',
];

function hasRunawayRepetition(text: string): boolean {
  const segments = text
    .split(/[\n.!?]+/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-z0-9\s]/g, ''))
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter((segment) => segment.length >= 20);

  if (segments.length < 8) return false;

  const counts = new Map<string, number>();
  let maxCount = 0;
  for (const segment of segments) {
    const next = (counts.get(segment) || 0) + 1;
    counts.set(segment, next);
    if (next > maxCount) maxCount = next;
  }

  return maxCount >= 4 && maxCount / segments.length >= 0.33;
}

export function createExponentialBackoff(options: BackoffOptions = {}) {
  const baseMs = Number.isFinite(options.baseMs) ? Number(options.baseMs) : 500;
  const maxMs = Number.isFinite(options.maxMs) ? Number(options.maxMs) : 8000;
  const jitter = Number.isFinite(options.jitter) ? Number(options.jitter) : 0.2;
  const rng = options.rng || Math.random;

  return (attempt: number) => {
    const safeAttempt = Math.max(1, Math.floor(attempt));
    const raw = Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
    if (jitter <= 0) return Math.round(raw);
    const jitterFactor = 1 + (rng() * 2 - 1) * jitter;
    return Math.round(raw * jitterFactor);
  };
}

export function isValidFinalResponse(
  text: unknown,
  options: { quitPhrases?: string[]; allowEmpty?: boolean } = {},
): text is string {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  // Allow empty responses if tool calls were made (model communicated through actions)
  if (!trimmed) return options.allowEmpty === true;
  const lowered = trimmed.toLowerCase();
  const phrases = options.quitPhrases || DEFAULT_QUIT_PHRASES;
  if (phrases.some((phrase) => lowered.includes(phrase))) return false;
  if (hasRunawayRepetition(trimmed)) return false;
  return true;
}
