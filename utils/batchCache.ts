// =============================================================================
// BATCH CACHE - Coordinates startup batch with useCachedData
// =============================================================================
// When the startup batch writes to AsyncStorage, it marks those cache keys
// as "batch-fresh". useCachedData checks this and skips its own network
// fetch on initial mount when the cache was just populated by the batch.
//
// Auto-expires after 30 seconds so subsequent focus/refresh still works.
// =============================================================================

import { registerCache } from '@/services/cacheRegistry';

/** Map of cache key → timestamp when batch wrote to it */
const batchFreshKeys = new Map<string, number>();

/** Max age in ms before a batch-written key is considered stale */
const BATCH_FRESH_MAX_AGE = 30_000; // 30 seconds

/**
 * Mark cache keys as freshly populated by the startup batch.
 * Call this after writing batch data to AsyncStorage.
 */
export function markBatchFresh(keys: string[]): void {
  const now = Date.now();
  for (const key of keys) {
    batchFreshKeys.set(key, now);
  }
}

/**
 * Check if a cache key was recently populated by the batch.
 * Returns true if the key was written within BATCH_FRESH_MAX_AGE.
 * Automatically cleans up expired entries.
 */
export function isBatchFresh(key: string): boolean {
  const ts = batchFreshKeys.get(key);
  if (!ts) return false;

  if (Date.now() - ts > BATCH_FRESH_MAX_AGE) {
    batchFreshKeys.delete(key);
    return false;
  }

  return true;
}

// Self-register so clearAllUserCaches() handles this on logout
registerCache({ clearMemory: () => batchFreshKeys.clear() });
