// =============================================================================
// USE TICKER POLLING - Keep last_activity fresh for Pusher broadcasts
// =============================================================================
// Polls GET /feeds/ticker every ~4 minutes to keep xprofile.last_activity
// fresh. The server skips Pusher broadcasts to users inactive >5 minutes,
// so we poll well within that window. Fires immediately on start and on
// app foreground. Pauses when backgrounded.
// =============================================================================

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getTicker } from '@/services/api/feeds';
import { createLogger } from '@/utils/logger';

const log = createLogger('Ticker');

const MIN_INTERVAL = 210_000; // 3.5 minutes
const MAX_INTERVAL = 270_000; // 4.5 minutes

function randomInterval(): number {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

/**
 * Polls /feeds/ticker to keep last_activity fresh.
 * Only runs when `enabled` is true (user is authenticated).
 */
export function useTickerPolling(enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sinceRef = useRef<string | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (!activeRef.current) return;

      try {
        const response = await getTicker(sinceRef.current ?? undefined);
        if (response.success) {
          sinceRef.current = response.data.timestamp;
        }
      } catch {
        // Silently ignore — this is a background keepalive, not critical
      }

      // Schedule next tick
      if (activeRef.current) {
        timerRef.current = setTimeout(tick, randomInterval());
      }
    };

    // Fire immediately — auth is already complete, mark user active ASAP
    tick();

    // Pause/resume on app state changes
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        if (!activeRef.current) {
          activeRef.current = true;
          log('Resumed');
          // Tick immediately on foreground, then schedule next
          tick();
        }
      } else {
        activeRef.current = false;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        log('Paused');
      }
    });

    log('Started');

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      activeRef.current = false;
      subscription.remove();
      log('Stopped');
    };
  }, [enabled]);
}
