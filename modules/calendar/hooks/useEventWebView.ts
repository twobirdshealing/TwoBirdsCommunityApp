// =============================================================================
// USE EVENT WEBVIEW - Hook to open calendar events in WebView
// =============================================================================
// Convenience wrapper around the generic /webview route for calendar events
// Automatically enables cart icon since events are purchasable
// =============================================================================

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { hapticMedium } from '@/utils/haptics';
import { createLogger } from '@/utils/logger';
import { CalendarEvent } from '@/modules/calendar/types/calendar';

const log = createLogger('EventWebView');

export function useEventWebView() {
  const router = useRouter();

  const openEvent = useCallback((event: CalendarEvent) => {
    log('Opening:', event.title, event.url);

    hapticMedium();

    router.push({
      pathname: '/webview',
      params: {
        url: event.url,
        title: event.title,
        rightIcon: 'cart-outline',
        rightAction: 'cart',
      },
    });
  }, [router]);

  return { openEvent };
}
