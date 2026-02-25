// =============================================================================
// USE SOCIAL PROVIDERS - Hook to consume dynamic social link providers
// =============================================================================
// Data arrives via /app-config (ThemeContext). This hook subscribes to the
// module-level cache and re-renders when providers update.
// Same listener pattern as useBadgeDefinitions.
// =============================================================================

import { useEffect, useState } from 'react';
import {
  getSocialProviders,
  subscribeSocialProviders,
  getProviderIcon,
  type SocialProvider,
} from '@/services/api/socialProviders';

/**
 * Returns the current list of admin-enabled social providers.
 * Re-renders automatically when providers are updated (e.g. after API refresh).
 */
export function useSocialProviders(): SocialProvider[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeSocialProviders(() => setTick((t) => t + 1));
  }, []);

  return getSocialProviders();
}

// Re-export for convenience
export { getProviderIcon } from '@/services/api/socialProviders';
export type { SocialProvider } from '@/services/api/socialProviders';
