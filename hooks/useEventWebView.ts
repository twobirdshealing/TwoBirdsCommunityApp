// =============================================================================
// USE EVENT WEBVIEW - Hook to open calendar events in WebView
// =============================================================================
// Convenience wrapper around the generic /webview route for calendar events
// Automatically enables cart icon since events are purchasable
// =============================================================================

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CalendarEvent } from '@/types/calendar';

export function useEventWebView() {
  const router = useRouter();

  const openEvent = useCallback((event: CalendarEvent) => {
    console.log('[useEventWebView] Opening:', event.title);
    console.log('[useEventWebView] URL:', event.url);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.push({
      pathname: '/webview',
      params: {
        url: event.url,
        title: event.title,
        showCart: 'true',  // Events need cart access for purchases
      },
    });
  }, [router]);

  return { openEvent };
}

export default useEventWebView;
