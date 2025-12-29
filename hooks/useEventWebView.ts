// =============================================================================
// USE EVENT WEBVIEW HOOK - Opens events in authenticated WebView
// =============================================================================
// Simple hook to handle opening calendar events in the WebView
// =============================================================================

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CalendarEvent } from '@/types/calendar';

interface UseEventWebViewReturn {
  openEvent: (event: CalendarEvent) => void;
  loading: boolean;
}

/**
 * Hook to open calendar events in an authenticated WebView
 * 
 * Usage:
 * ```tsx
 * const { openEvent, loading } = useEventWebView();
 * 
 * <EventCard 
 *   event={event} 
 *   onPress={() => openEvent(event)} 
 * />
 * ```
 */
export function useEventWebView(): UseEventWebViewReturn {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const openEvent = useCallback((event: CalendarEvent) => {
    if (loading) return;
    
    console.log('[useEventWebView] Opening event:', event.title);
    console.log('[useEventWebView] Event URL:', event.url);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Navigate to WebView screen with event URL
    // The WebView screen will handle session creation
    router.push({
      pathname: '/event-webview',
      params: {
        eventUrl: event.url,
        title: event.title,
      },
    });
  }, [router, loading]);

  return { openEvent, loading };
}

export default useEventWebView;
