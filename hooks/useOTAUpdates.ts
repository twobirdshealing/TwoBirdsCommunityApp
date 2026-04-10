// =============================================================================
// OTA UPDATE HOOK — Silent background update check
// =============================================================================
// Checks for over-the-air updates on mount. If an update is available, it
// downloads silently and applies on the next cold start. No UI disruption.
// Disabled automatically in dev client (__DEV__) and when expo-updates is off.
// =============================================================================

import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { createLogger } from '@/utils/logger';

const log = createLogger('OTA');

export function useOTAUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          log.debug('Update available, downloading...');
          await Updates.fetchUpdateAsync();
          log.debug('Update downloaded — will apply on next launch');
        }
      } catch (e) {
        log.warn('Update check failed:', { e });
      }
    })();
  }, []);
}
