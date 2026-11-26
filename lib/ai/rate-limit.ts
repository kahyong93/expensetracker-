import 'server-only';

/**
 * In-memory sliding-window rate limit (CLAUDE.md §7, ADR 0001). Counted per server
 * instance and reset on restart, which is fine for a personal app.
 */

export const AI_REQUESTS_PER_MINUTE = 15;
const WINDOW_MS = 60_000;

export type RateLimiter = {
  /** Records a request for `key`. Returns false (and records nothing) when over the limit. */
  take(key: string): boolean;
};

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    take(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}

/** The app's shared limiter, keyed by Clerk user id. */
export const aiRateLimiter = createRateLimiter({ limit: AI_REQUESTS_PER_MINUTE, windowMs: WINDOW_MS });
