// =============================================================================
// USE EVENT WEBVIEW - Simple hook to open events in WebView
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
      pathname: '/event-webview',
      params: {
        eventUrl: event.url,
        title: event.title,
      },
    });
  }, [router]);

  return { openEvent };
}

export default useEventWebView;
