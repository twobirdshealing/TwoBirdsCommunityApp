// =============================================================================
// CALENDAR SCREEN - Native events calendar
// =============================================================================
// Phase 1: Native calendar with list view
// - Featured events horizontal scroll
// - Month navigation
// - Event list with status badges
// - Pull to refresh
// - Tap event shows "Coming Soon" (WebView in Phase 2)
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';
import { calendarApi } from '@/services/api/calendar';
import { CalendarEvent, CalendarViewMode } from '@/types/calendar';
import {
  CalendarHeader,
  EventList,
  FeaturedEvents,
} from '@/components/calendar';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addMonths(monthString: string, count: number): string {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1 + count, 1);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${newYear}-${newMonth}`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CalendarScreen() {
  // State
  const [viewMode, setViewMode] = useState<CalendarViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate month limits (current month to +2 months like web)
  const minMonth = getCurrentMonth();
  const maxMonth = addMonths(getCurrentMonth(), 2);

  // ---------------------------------------------------------------------------
  // Fetch Events
  // ---------------------------------------------------------------------------

  const fetchEvents = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await calendarApi.getEvents({
        month: currentMonth,
        limit: 50,
      });

      if (!response.success) {
        setError(response.error?.message || 'Failed to load events');
        return;
      }

      setEvents(response.data.events || []);
    } catch (err) {
      console.error('[Calendar] Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth]);

  // ---------------------------------------------------------------------------
  // Fetch Featured Events
  // ---------------------------------------------------------------------------

  const fetchFeaturedEvents = useCallback(async () => {
    try {
      setFeaturedLoading(true);

      const response = await calendarApi.getFeaturedEvents(3);

      if (response.success) {
        setFeaturedEvents(response.data.events || []);
      }
    } catch (err) {
      console.error('[Calendar] Error fetching featured events:', err);
      // Don't show error for featured - just don't display them
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Fetch events when month changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Fetch featured events on mount
  useEffect(() => {
    fetchFeaturedEvents();
  }, [fetchFeaturedEvents]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchEvents(true);
    fetchFeaturedEvents();
  };

  const handlePrevMonth = () => {
    const prevMonth = addMonths(currentMonth, -1);
    if (prevMonth >= minMonth) {
      setCurrentMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    if (nextMonth <= maxMonth) {
      setCurrentMonth(nextMonth);
    }
  };

  const handleEventPress = (event: CalendarEvent) => {
    // Phase 1: Show coming soon alert
    // Phase 2: Open WebView with event.url
    Alert.alert(
      event.title,
      'Event details and booking will be available soon.\n\n' +
      `📅 ${event.start}\n` +
      (event.location?.business_name ? `📍 ${event.location.business_name}\n` : '') +
      (event.price_raw === 0 ? '💝 Love Donations' : `💳 $${event.price_raw}`),
      [{ text: 'OK' }]
    );
  };

  const handleWaitlistToggle = async (event: CalendarEvent) => {
    if (!event.user) {
      Alert.alert('Login Required', 'Please log in to join the waitlist.');
      return;
    }

    try {
      if (event.user.is_on_waitlist) {
        const response = await calendarApi.leaveWaitlist(event.product_id, event.start);
        if (response.success) {
          Alert.alert('Success', 'Removed from waitlist');
          fetchEvents(true);
        } else {
          Alert.alert('Error', response.error?.message || 'Failed to leave waitlist');
        }
      } else {
        const response = await calendarApi.joinWaitlist(event.product_id, event.start);
        if (response.success) {
          Alert.alert('Success', 'Added to waitlist');
          fetchEvents(true);
        } else {
          Alert.alert('Error', response.error?.message || 'Failed to join waitlist');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // List Header Component (Featured Events + Calendar Header)
  const ListHeader = (
    <View>
      {/* Featured Events */}
      <FeaturedEvents
        events={featuredEvents}
        loading={featuredLoading}
        onEventPress={handleEventPress}
      />

      {/* Calendar Header */}
      <CalendarHeader
        currentMonth={currentMonth}
        viewMode={viewMode}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onViewModeChange={setViewMode}
        canGoPrev={currentMonth > minMonth}
        canGoNext={currentMonth < maxMonth}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {viewMode === 'list' ? (
        <EventList
          events={events}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={handleRefresh}
          onEventPress={handleEventPress}
          onWaitlistToggle={handleWaitlistToggle}
          ListHeaderComponent={ListHeader}
          emptyMessage={`No events scheduled for ${new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
        />
      ) : (
        // Month view - Phase 2
        <View style={styles.container}>
          {ListHeader}
          <View style={styles.comingSoon}>
            {/* Month grid will go here in Phase 2 */}
          </View>
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
