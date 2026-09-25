/**
 * In-Memory Sliding-Window Rate Limiter
 *
 * Lightweight, zero-dependency rate limiting suitable for single-instance,
 * containerized, or local application deployments.
 *
 * Protects sensitive endpoints (e.g. login authentication, file uploads)
 * against brute-force attacks and abuse.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of allowed requests per window */
  maxRequests: number;
}

// In-memory bucket store
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Checks and increments the hit counter for a given key.
 *
 * @param key Unique identifier (e.g. `login:${ip}`, `upload:${userId}`)
 * @param options Rate limit window and threshold
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanupStaleEntries();

  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    // New or expired window
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    rateLimitStore.set(key, newRecord);

    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: newRecord.resetAt,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  // Active window
  if (existing.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.maxRequests - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Resets rate limit for a specific key (e.g. after a successful login).
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
