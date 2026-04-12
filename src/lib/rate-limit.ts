/**
 * Rate limiter with Upstash Redis support.
 *
 * - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set → uses Upstash (multi-instance safe).
 * - Otherwise → falls back to in-memory Map (works only on single-instance / local dev).
 *
 * To enable Upstash on Vercel:
 *   1. Create a Redis database at https://console.upstash.com
 *   2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel environment variables
 *   3. No code changes needed — this module detects them automatically
 */

// ─────────────────────────────────────────────
// In-memory fallback (single-instance only)
// ─────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

function rateLimitInMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ─────────────────────────────────────────────
// Upstash Redis (multi-instance safe)
// ─────────────────────────────────────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

if (!USE_UPSTASH) {
  console.warn(
    '[rate-limit] WARNING: Using in-memory rate limiter. ' +
    'This is NOT effective on multi-instance deployments (Vercel). ' +
    'Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable distributed rate limiting.'
  );
}

async function rateLimitUpstash(key: string, limit: number, windowMs: number) {
  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey = `rl:${key}`;

  try {
    // Use Upstash REST API directly — no SDK dependency needed
    const pipeline = [
      ['INCR', redisKey],
      ['EXPIRE', redisKey, windowSec, 'NX'], // Set expiry only on first increment
    ];

    const response = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
      signal: AbortSignal.timeout(3000), // 3s timeout — don't block the request
    });

    if (!response.ok) {
      console.error('[rate-limit] Upstash returned non-ok status, failing open:', response.status);
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
    }

    const results = await response.json() as [{ result: number }, { result: number }];
    const count = results[0].result;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining, resetAt: Date.now() + windowMs };
  } catch (err) {
    // Network error, timeout, or any unexpected failure — fail open
    console.error('[rate-limit] Upstash exception, failing open:', err instanceof Error ? err.message : err);
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

// ─────────────────────────────────────────────
// Public API — same interface as before
// ─────────────────────────────────────────────

/**
 * @param key      Unique identifier (e.g. `chat:${userId}`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } | Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (USE_UPSTASH) {
    return rateLimitUpstash(key, limit, windowMs);
  }
  return rateLimitInMemory(key, limit, windowMs);
}
