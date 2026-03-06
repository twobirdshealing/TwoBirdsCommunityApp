// =============================================================================
// EVENTS WIDGET - Featured events carousel for home page
// =============================================================================
// Fetches featured events and renders existing FeaturedEvents component.
// Uses useCachedData for stale-while-revalidate caching.
// Returns null if no events or fetch fails.
// =============================================================================

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import calendarApi from '@/services/api/calendar';
import { CalendarEvent } from '@/types/calendar';
import { FeaturedEvents } from '@/components/calendar/FeaturedEvents';
import { useEventWebView } from '@/hooks/useEventWebView';
import { useCachedData } from '@/hooks/useCachedData';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface EventsWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EventsWidget({ refreshKey }: EventsWidgetProps) {
  const { colors: themeColors } = useTheme();
  const { openEvent } = useEventWebView();

  const { data: events, isLoading } = useCachedData<CalendarEvent[]>({
    cacheKey: 'tbc_widget_featured_events',
    fetcher: async () => {
      const response = await calendarApi.getFeaturedEvents(6);
      if (!response.success) return [];
      return response.data.events;
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: 120_000,
  });

  // Loading state on first load only (no cache yet)
  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }

  if (!events || events.length === 0) return null;

  return (
    <FeaturedEvents
      events={events}
      onEventPress={openEvent}
    />
  );
}

export default EventsWidget;
