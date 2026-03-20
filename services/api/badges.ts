// =============================================================================
// BADGE API SERVICE - Fetch & cache Fluent Community badge definitions
// =============================================================================
// Public endpoint (no auth needed) — returns badge colors, labels, icons
// Two-layer cache: MMKV (persists across restarts) + in-memory
// Same pattern as theme colors — instant on launch, background refresh
// =============================================================================

import { getJSON, setJSON } from '@/services/storage';
import { TBC_CA_URL } from '@/constants/config';
import type { Badge } from '@/types/user';
import { createLogger } from '@/utils/logger';
import { registerCache } from '@/services/cacheRegistry';

const log = createLogger('BadgeAPI');

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

// Self-register so clearAllUserCaches() handles this on logout
registerCache({ clearMemory: () => { cachedBadges = null; } });

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * Load badge definitions from MMKV (instant, synchronous).
 * Called before the API fetch to provide immediate data.
 */
export function loadCachedBadges(): BadgeDefinitions {
  if (cachedBadges) return cachedBadges;

  const stored = getJSON<BadgeDefinitions>(BADGE_CACHE_KEY);
  if (stored) {
    cachedBadges = stored;
    return cachedBadges;
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

      // Persist to MMKV for next launch
      setJSON(BADGE_CACHE_KEY, data.badges);

      return cachedBadges;
    }
    return cachedBadges || {};
  } catch (error) {
    log.error(error);
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

