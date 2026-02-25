// =============================================================================
// EVENTS WIDGET - Featured events carousel for home page
// =============================================================================
// Fetches featured events and renders existing FeaturedEvents component.
// Returns null if no events or fetch fails.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import calendarApi from '@/services/api/calendar';
import { CalendarEvent } from '@/types/calendar';
import { FeaturedEvents } from '@/components/calendar/FeaturedEvents';
import { useEventWebView } from '@/hooks/useEventWebView';

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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await calendarApi.getFeaturedEvents(6);
      if (__DEV__) console.log('[EventsWidget] response:', JSON.stringify(response).slice(0, 200));
      if (response.success) {
        setEvents(response.data.events);
      }
    } catch (err) {
      if (__DEV__) console.error('[EventsWidget] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, refreshKey]);

  // Loading state on first load only
  if (loading && events.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }

  if (events.length === 0) return null;

  return (
    <FeaturedEvents
      events={events}
      onEventPress={openEvent}
    />
  );
}

export default EventsWidget;
