// =============================================================================
// USE BADGE DEFINITIONS - Hook to fetch & resolve profile badges
// =============================================================================
// Two-layer cache (same as theme colors):
// 1. Load from SecureStore instantly (badges appear on first render)
// 2. Background-refresh from API, update SecureStore for next launch
// =============================================================================

import { useEffect, useState } from 'react';
import { loadCachedBadges, fetchBadgeDefinitions, resolveBadges } from '@/services/api/badges';
import type { Badge } from '@/types/user';

let _initialized = false;
let _listeners: Array<() => void> = [];

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

/**
 * Ensures badge definitions are loaded, returns a resolver function.
 * First call loads from SecureStore (instant), then background-refreshes.
 * All components share the same cache.
 */
export function useBadgeDefinitions() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    _listeners.push(listener);

    if (!_initialized) {
      _initialized = true;

      // 1. Load cached badges from SecureStore (instant)
      loadCachedBadges().then((cached) => {
        if (Object.keys(cached).length > 0) {
          notifyListeners();
        }

        // 2. Background-refresh from API
        fetchBadgeDefinitions().then(() => notifyListeners());
      });
    }

    return () => {
      _listeners = _listeners.filter((fn) => fn !== listener);
    };
  }, []);

  return { resolveBadges };
}

/**
 * Convenience: resolve badges for a given xprofile's meta.badge_slug
 */
export function useProfileBadges(badgeSlugs?: string[]): Badge[] {
  useBadgeDefinitions(); // ensure definitions loaded
  return resolveBadges(badgeSlugs || []);
}
