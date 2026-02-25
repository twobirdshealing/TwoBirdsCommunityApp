// =============================================================================
// CALENDAR SCREEN - Modern native events calendar
// =============================================================================
// Features:
// - Slim month navigation header
// - List view: Full-width event cards
// - Month view: Grid with event dots + selected day events
// - Pull to refresh
// - WebView integration for event booking (Phase 2)
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { calendarApi } from '@/services/api/calendar';
import { CalendarEvent, CalendarViewMode } from '@/types/calendar';
import { useEventWebView } from '@/hooks/useEventWebView';
import {
  CalendarHeader,
  EventCard,
  EventList,
  MonthGrid,
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

function formatSelectedDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CalendarScreen() {
  // WebView hook for opening events
  const { openEvent } = useEventWebView();
  const { colors: themeColors } = useTheme();

  // State
  const [viewMode, setViewMode] = useState<CalendarViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate month limits (current month to +2 months like web)
  const minMonth = getCurrentMonth();
  const maxMonth = addMonths(getCurrentMonth(), 2);

  // Get events for selected date (month view)
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(event => {
      const startDate = event.start;
      const endDate = event.end;
      return selectedDate >= startDate && selectedDate <= endDate;
    });
  }, [events, selectedDate]);

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
      if (__DEV__) console.error('[Calendar] Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset selected date when month changes
  useEffect(() => {
    setSelectedDate(null);
  }, [currentMonth]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchEvents(true);
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

  // Open event in authenticated WebView
  const handleEventPress = (event: CalendarEvent) => {
    openEvent(event);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date === selectedDate ? null : date);
  };

  // ---------------------------------------------------------------------------
  // Render Header (shared between views)
  // ---------------------------------------------------------------------------

  const renderHeader = () => (
    <>
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
    </>
  );

  // ---------------------------------------------------------------------------
  // Render Month View
  // ---------------------------------------------------------------------------

  const renderMonthView = () => (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={themeColors.primary}
          colors={[themeColors.primary]}
        />
      }
    >
      {renderHeader()}

      {/* Month Grid */}
      <MonthGrid
        month={currentMonth}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* Selected Day Events */}
      {selectedDate && (
        <View style={styles.selectedDaySection}>
          <Text style={[styles.selectedDayTitle, { color: themeColors.text }]}>
            {formatSelectedDate(selectedDate)}
          </Text>

          {selectedDateEvents.length === 0 ? (
            <Text style={[styles.noEventsText, { color: themeColors.textSecondary }]}>No events on this day</Text>
          ) : (
            selectedDateEvents.map(event => (
              <EventCard
                key={`${event.product_id}-${event.start}`}
                event={event}
                onPress={() => handleEventPress(event)}
                compact
              />
            ))
          )}
        </View>
      )}

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  // ---------------------------------------------------------------------------
  // Render List View
  // ---------------------------------------------------------------------------

  const renderListView = () => (
    <EventList
      events={events}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={handleRefresh}
      onEventPress={handleEventPress}
      ListHeaderComponent={renderHeader()}
      emptyMessage={`No events in ${new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long' })}`}
    />
  );

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {viewMode === 'month' ? renderMonthView() : renderListView()}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  selectedDaySection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  selectedDayTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  noEventsText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  bottomPadding: {
    height: spacing.xl,
  },
});
