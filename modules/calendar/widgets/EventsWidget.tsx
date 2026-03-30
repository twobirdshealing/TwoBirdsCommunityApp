// =============================================================================
// EVENTS WIDGET - Featured events carousel for home page
// =============================================================================
// Fetches featured events and renders existing FeaturedEvents component.
// Uses useAppQuery for stale-while-revalidate caching.
// Returns null if no events or fetch fails.
// =============================================================================

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import calendarApi from '@/modules/calendar/services/calendarApi';
import { CalendarEvent } from '@/modules/calendar/types/calendar';
import { FeaturedEvents } from '@/modules/calendar/components/FeaturedEvents';
import { useEventWebView } from '@/modules/calendar/hooks/useEventWebView';
import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { HomeWidget } from '@/components/home/HomeWidget';
import type { WidgetComponentProps } from '@/modules/_types';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EventsWidget({ refreshKey, title, icon, onSeeAll }: WidgetComponentProps) {
  const { colors: themeColors } = useTheme();
  const { openEvent } = useEventWebView();

  const { data: events, isLoading } = useAppQuery<CalendarEvent[]>({
    cacheKey: 'tbc_widget_featured_events',
    fetcher: async () => {
      const response = await calendarApi.getFeaturedEvents(6);
      if (!response.success) return [];
      return response.data.events;
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: WIDGET_STALE_TIME,
  });

  // Loading state on first load only (no cache yet)
  if (isLoading) {
    return (
      <HomeWidget title={title} icon={icon} onSeeAll={onSeeAll}>
        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={themeColors.primary} />
        </View>
      </HomeWidget>
    );
  }

  if (!events || events.length === 0) return null;

  return (
    <HomeWidget title={title} icon={icon} onSeeAll={onSeeAll}>
      <FeaturedEvents
        events={events}
        onEventPress={openEvent}
      />
    </HomeWidget>
  );
}

export default EventsWidget;
