// =============================================================================
// BADGE API SERVICE - Fetch & cache Fluent Community badge definitions
// =============================================================================
// Public endpoint (no auth needed) — returns badge colors, labels, icons
// Two-layer cache: AsyncStorage (persists across restarts) + in-memory
// Same pattern as theme colors — instant on launch, background refresh
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TBC_CA_URL } from '@/constants/config';
import type { Badge } from '@/types/user';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw badge definitions keyed by slug (as returned by API) */
export type BadgeDefinitions = Record<string, Omit<Badge, 'slug'>>;

interface BadgeDefinitionsResponse {
  success: boolean;
  badges: BadgeDefinitions | Record<string, never>;
}

// -----------------------------------------------------------------------------
// Cache
// -----------------------------------------------------------------------------

const BADGE_CACHE_KEY = 'tbc_badge_definitions';
let cachedBadges: BadgeDefinitions | null = null;

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * Load badge definitions from AsyncStorage (instant, no network).
 * Called before the API fetch to provide immediate data.
 */
export async function loadCachedBadges(): Promise<BadgeDefinitions> {
  if (cachedBadges) return cachedBadges;

  try {
    const stored = await AsyncStorage.getItem(BADGE_CACHE_KEY);
    if (stored) {
      cachedBadges = JSON.parse(stored);
      return cachedBadges!;
    }
  } catch (e) {
    // Silent fail — will fetch from API
  }
  return {};
}

/**
 * GET /badge-definitions - Fetch fresh from API and update both caches.
 * Always hits network (for background refresh).
 */
export async function fetchBadgeDefinitions(): Promise<BadgeDefinitions> {
  try {
    const response = await fetch(`${TBC_CA_URL}/badge-definitions`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return cachedBadges || {};

    const data: BadgeDefinitionsResponse = await response.json();
    if (data.success && data.badges) {
      cachedBadges = data.badges;

      // Persist to AsyncStorage for next launch
      try {
        await AsyncStorage.setItem(BADGE_CACHE_KEY, JSON.stringify(data.badges));
      } catch (e) {
        // Persist failed — in-memory still works
      }

      return cachedBadges;
    }
    return cachedBadges || {};
  } catch (error) {
    if (__DEV__) console.error('[Badge API]', error);
    return cachedBadges || {};
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Resolve an array of badge slugs into full Badge objects using the cache.
 * Returns empty array if definitions haven't been fetched yet.
 */
export function resolveBadges(slugs: string[]): Badge[] {
  if (!cachedBadges || !slugs?.length) return [];
  return slugs
    .filter((slug) => cachedBadges![slug])
    .map((slug) => ({ slug, ...cachedBadges![slug] }));
}

/**
 * Clear both in-memory and AsyncStorage badge cache (e.g. on logout)
 */
export function clearBadgeCache() {
  cachedBadges = null;
  AsyncStorage.removeItem(BADGE_CACHE_KEY).catch((e) => {
    if (__DEV__) console.warn('[Badges] Cache clear failed:', e);
  });
}
