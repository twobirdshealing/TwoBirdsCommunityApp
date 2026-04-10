// =============================================================================
// CACHE REGISTRY - Centralized cache clearing on logout
// =============================================================================
// Solves the "forgotten cache key" problem: instead of manually listing
// every MMKV prefix to clear, we clear ALL tbc_* keys EXCEPT an explicit
// keep-list. Also clears TanStack Query cache and in-memory caches.
//
// Usage:
//   import { registerCache } from '@/services/cacheRegistry';
//   registerCache({ clearMemory: () => { myCache = null; } });
//
// On logout, AuthContext calls clearAllUserCaches() once — no manual wiring.
// =============================================================================

import { storage } from '@/services/storage';
import { queryClient } from '@/services/queryClient';
import { createLogger } from '@/utils/logger';

const log = createLogger('CacheRegistry');

// -----------------------------------------------------------------------------
// Keys that survive logout (device/site-level, not user-specific)
// -----------------------------------------------------------------------------

// Only tbc_* keys need listing here — non-prefixed keys are already excluded by the filter.
const PERSIST_ACROSS_LOGOUT: string[] = [
  'tbc_app_config_cache',         // Site maintenance, update config, branding
  'tbc_app_visibility_cache',     // Site-level menu visibility (hide_menu[])
  'tbc_socket_config_cache',      // Socket provider config (Pusher/Soketi) — site-level, not user-specific
  'tbc_app_features_cache',       // Feature flags — site-level, not user-specific
  'tbc_registration_config_cache', // Registration capabilities — site-level
];

// -----------------------------------------------------------------------------
// In-memory cache registration
// -----------------------------------------------------------------------------

type ClearFn = () => void;
const memoryClearFns: ClearFn[] = [];

/**
 * Register an in-memory cache's clear function.
 * Called at module scope so caches self-register on import.
 */
export function registerCache(opts: { clearMemory: ClearFn }): void {
  memoryClearFns.push(opts.clearMemory);
}

// -----------------------------------------------------------------------------
// Bulk clear (called on logout)
// -----------------------------------------------------------------------------

/**
 * Clear all user-specific caches:
 * 1. Removes ALL tbc_* MMKV keys except the keep-list
 * 2. Clears TanStack Query cache
 * 3. Calls all registered in-memory clear functions
 */
export function clearAllUserCaches(): void {
  // 1. MMKV — clear all tbc_* keys except persist list (synchronous)
  try {
    const allKeys = storage.getAllKeys();
    let cleared = 0;
    for (const key of allKeys) {
      if (key.startsWith('tbc_') && !PERSIST_ACROSS_LOGOUT.includes(key)) {
        storage.remove(key);
        cleared++;
      }
    }
    if (cleared > 0) {
      log.debug('Cleared cached keys', { count: cleared });
    }
  } catch (e) {
    log.error(e, 'MMKV clear failed');
  }

  // 2. Clear TanStack Query cache
  queryClient.clear();

  // 3. In-memory caches
  for (const clear of memoryClearFns) {
    try {
      clear();
    } catch (e) {
      log.error(e, 'Memory cache clear failed');
    }
  }
}
