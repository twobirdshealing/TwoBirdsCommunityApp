// =============================================================================
// FEATURE FLAGS — Non-React access for service-layer code
// =============================================================================
// Reads from the same AsyncStorage cache that AppConfigContext writes.
// Uses an in-memory cache to avoid repeated AsyncStorage bridge hits.
// Returns conservative defaults (all OFF) if no cache exists yet.
// Use useFeatures() hook in React components instead.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BooleanFeatureKey, FeaturesConfig } from '@/services/api/appConfig';

// -----------------------------------------------------------------------------
// Shared constants (imported by AppConfigContext — keep here to avoid circular)
// -----------------------------------------------------------------------------

export const FEATURES_CACHE_KEY = 'tbc_app_features_cache';

/** Conservative defaults — everything disabled until server config loads. */
export const DEFAULT_FEATURES: FeaturesConfig = {
  dark_mode: false,
  push_notifications: false,
  messaging: false,
  courses: false,
  profile_tabs: { posts: false, spaces: false, comments: false },
};

// -----------------------------------------------------------------------------
// In-memory cache
// -----------------------------------------------------------------------------

/** In-memory cache — populated on first read, stays warm thereafter. */
let memoryCache: FeaturesConfig | null = null;

/** Called by AppConfigContext when features are updated from server. */
export function setFeatureFlagCache(features: FeaturesConfig): void {
  memoryCache = features;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Read a boolean feature flag from cache. Returns false (conservative) if no cache exists.
 * Only used by non-React service code (e.g. AuthContext). React components use useFeatures().
 */
export async function getFeatureFlag(key: BooleanFeatureKey): Promise<boolean> {
  if (memoryCache) return memoryCache[key] ?? false;

  try {
    const cached = await AsyncStorage.getItem(FEATURES_CACHE_KEY);
    if (cached) {
      memoryCache = JSON.parse(cached);
      if (memoryCache![key] !== undefined) return memoryCache![key];
    }
  } catch {}
  // No cache — conservative default (off). The startup gate ensures
  // authenticated users never reach the main app in this state.
  return false;
}
