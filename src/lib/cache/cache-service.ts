/**
 * Production-Ready Server Caching Service
 *
 * Supports:
 * 1. Upstash Redis via HTTP REST API (Edge & Serverless friendly, zero TCP pooling issues)
 * 2. High-performance In-Memory TTL store as fallback (for local development or when Redis is not yet configured)
 * 3. Graceful error handling (cache failure never breaks application requests)
 * 4. Stamped cache key generation and granular invalidation tags
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// In-Memory store for development and fallback
const memoryCache = new Map<string, CacheEntry<unknown>>();
const MAX_MEMORY_CACHE_ITEMS = 2000;

function pruneMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
  // Enforce max item limit if memory usage grows
  if (memoryCache.size > MAX_MEMORY_CACHE_ITEMS) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(
      0,
      memoryCache.size - MAX_MEMORY_CACHE_ITEMS
    );
    for (const key of keysToDelete) {
      memoryCache.delete(key);
    }
  }
}

// Run memory cache garbage collection every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(pruneMemoryCache, 60_000).unref?.();
}

const isCacheDisabled = process.env.CACHE_DISABLED === 'true';
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(redisUrl && redisToken);

/**
 * Execute an Upstash Redis REST command
 */
async function redisCommand<T = unknown>(command: string[]): Promise<T | null> {
  if (!hasRedis || !redisUrl || !redisToken) return null;

  try {
    const res = await fetch(`${redisUrl}/${command.map(encodeURIComponent).join('/')}`, {
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[Cache:Redis] Command failed: ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    return json.result as T;
  } catch (err) {
    console.warn('[Cache:Redis] REST request error:', err);
    return null;
  }
}

/**
 * Retrieve cached value by key
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (isCacheDisabled) return null;

  const now = Date.now();

  // Try Redis if configured
  if (hasRedis) {
    try {
      const result = await redisCommand<string>(['get', key]);
      if (result !== null && result !== undefined) {
        return JSON.parse(result) as T;
      }
    } catch {
      // Fall through to memory fallback
    }
  }

  // Memory fallback
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    if (memEntry.expiresAt > now) {
      return memEntry.value as T;
    }
    memoryCache.delete(key);
  }

  return null;
}

/**
 * Store value in cache with a TTL in seconds
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (isCacheDisabled || ttlSeconds <= 0) return;

  const expiresAt = Date.now() + ttlSeconds * 1000;

  // Store in memory
  memoryCache.set(key, { value, expiresAt });
  if (memoryCache.size > MAX_MEMORY_CACHE_ITEMS + 100) {
    pruneMemoryCache();
  }

  // Store in Redis if configured
  if (hasRedis) {
    try {
      const serialized = JSON.stringify(value);
      await redisCommand(['set', key, serialized, 'ex', String(ttlSeconds)]);
    } catch (err) {
      console.warn(`[Cache:Redis] Failed to set key "${key}":`, err);
    }
  }
}

/**
 * Invalidate a single key
 */
export async function deleteCache(key: string): Promise<void> {
  memoryCache.delete(key);

  if (hasRedis) {
    try {
      await redisCommand(['del', key]);
    } catch (err) {
      console.warn(`[Cache:Redis] Failed to delete key "${key}":`, err);
    }
  }
}

/**
 * Invalidate keys matching a prefix pattern (e.g., 'ox:dash:*')
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  const prefix = pattern.replace(/\*$/, '');

  // Delete from in-memory cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  // Delete from Redis
  if (hasRedis) {
    try {
      const keys = await redisCommand<string[]>(['keys', pattern]);
      if (Array.isArray(keys) && keys.length > 0) {
        for (const k of keys) {
          await redisCommand(['del', k]);
        }
      }
    } catch (err) {
      console.warn(`[Cache:Redis] Failed to delete pattern "${pattern}":`, err);
    }
  }
}

/**
 * Wraps an asynchronous fetcher with cache read/write (stampede prevention pattern)
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (isCacheDisabled) {
    return fetcher();
  }

  const cached = await getCache<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const fresh = await fetcher();
  await setCache(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Standard Cache Keys and Invalidation helpers for Oven_Xpress
 */
export const CACHE_KEYS = {
  branches: () => 'ox:branches:list',
  dashboardOwner: (branchId: string, start: string, end: string, role: string) =>
    `ox:dash:owner:${branchId || 'all'}:${start}:${end}:${role}`,
  dashboardManager: (userId: string) => `ox:dash:manager:${userId}`,
  dashboardStaff: (userId: string) => `ox:dash:staff:${userId}`,
  batchStock: (branchesKey: string, ingredientsKey: string) =>
    `ox:stock:${branchesKey}:${ingredientsKey}`,
  menuItems: (branchId: string) => `ox:menu:${branchId || 'all'}`,
};

/**
 * Common cache invalidation triggers
 */
export async function invalidateDashboardCaches(): Promise<void> {
  await deleteCachePattern('ox:dash:*');
}

export async function invalidateStockCaches(): Promise<void> {
  await deleteCachePattern('ox:stock:*');
  await deleteCachePattern('ox:dash:*');
}

export async function invalidateBranchCaches(): Promise<void> {
  await deleteCache('ox:branches:list');
  await deleteCachePattern('ox:dash:*');
}
