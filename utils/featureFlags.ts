// =============================================================================
// FEATURE FLAGS — Non-React access for service-layer code
// =============================================================================
// Reads from the same AsyncStorage cache that AppConfigContext writes.
// Uses an in-memory cache to avoid repeated AsyncStorage bridge hits.
// Falls back to hardcoded defaults on first launch (before server fetch).
// Use useFeatures() hook in React components instead.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeaturesConfig } from '@/services/api/appConfig';

// -----------------------------------------------------------------------------
// Shared constants (imported by AppConfigContext — keep here to avoid circular)
// -----------------------------------------------------------------------------

export const FEATURES_CACHE_KEY = 'tbc_app_features_cache';

export const DEFAULT_FEATURES: FeaturesConfig = {
  dark_mode: true,
  push_notifications: true,
  messaging: true,
  courses: true,
  multi_reactions: true,
  profile_tabs: {
    posts: false,
    spaces: false,
    comments: false,
  },
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

/** Read a feature flag from cache. Falls back to default if cache is empty. */
export async function getFeatureFlag<K extends keyof FeaturesConfig>(key: K): Promise<FeaturesConfig[K]> {
  if (memoryCache) return memoryCache[key] ?? DEFAULT_FEATURES[key];

  try {
    const cached = await AsyncStorage.getItem(FEATURES_CACHE_KEY);
    if (cached) {
      memoryCache = JSON.parse(cached);
      if (memoryCache![key] !== undefined) return memoryCache![key];
    }
  } catch {}
  return DEFAULT_FEATURES[key];
}
