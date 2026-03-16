// =============================================================================
// CACHE REGISTRY - Centralized cache clearing on logout
// =============================================================================
// Solves the "forgotten cache key" problem: instead of manually listing
// every AsyncStorage prefix to clear, we clear ALL tbc_* keys EXCEPT
// an explicit keep-list. In-memory caches self-register their clear functions.
//
// Usage:
//   import { registerCache } from '@/services/cacheRegistry';
//   registerCache({ clearMemory: () => { myCache = null; } });
//
// On logout, AuthContext calls clearAllUserCaches() once — no manual wiring.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/utils/logger';

const log = createLogger('CacheRegistry');

// -----------------------------------------------------------------------------
// Keys that survive logout (device/site-level, not user-specific)
// -----------------------------------------------------------------------------

// Only tbc_* keys need listing here — non-prefixed keys are already excluded by the filter.
const PERSIST_ACROSS_LOGOUT: string[] = [
  'tbc_app_config_cache',      // Site maintenance, update config, branding
  'tbc_app_visibility_cache',  // Site-level menu visibility (hide_menu[])
  'tbc_socket_config_cache',   // Socket provider config (Pusher/Soketi) — site-level, not user-specific
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
 * 1. Removes ALL tbc_* AsyncStorage keys except the keep-list
 * 2. Calls all registered in-memory clear functions
 */
export async function clearAllUserCaches(): Promise<void> {
  // 1. AsyncStorage — clear all tbc_* keys except persist list
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(
      (k) => k.startsWith('tbc_') && !PERSIST_ACROSS_LOGOUT.includes(k)
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      log('Cleared', keysToRemove.length, 'cached keys');
    }
  } catch (e) {
    log.error('AsyncStorage clear failed:', e);
  }

  // 2. In-memory caches
  for (const clear of memoryClearFns) {
    try {
      clear();
    } catch (e) {
      log.error('Memory cache clear failed:', e);
    }
  }
}
