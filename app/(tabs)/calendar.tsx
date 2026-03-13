// =============================================================================
// CALENDAR SCREEN - Modern native events calendar
// =============================================================================
// Features:
// - Slim month navigation header
// - List view: Full-width event cards
// - Month view: Grid with event dots + selected day events
// - Pull to refresh
// - WebView integration for event booking
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calendarApi } from '@/services/api/calendar';
import { useCachedData } from '@/hooks/useCachedData';
import { CalendarEvent, CalendarViewMode } from '@/types/calendar';
import { useEventWebView } from '@/hooks/useEventWebView';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { EventCard } from '@/components/calendar/EventCard';
import { EventList } from '@/components/calendar/EventList';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { TabActivityWrapper } from '@/components/common/TabActivityWrapper';

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
  const { handleScroll } = useTabBar();
  const insets = useSafeAreaInsets();
  const { currentBook } = useAudioPlayerContext();
  const bottomPadding = sizing.height.tabBar + insets.bottom + (currentBook ? 59 : 0) + spacing.md;

  // State
  const [viewMode, setViewMode] = useState<CalendarViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate month limits (current month to +2 months like web)
  const minMonth = getCurrentMonth();
  const maxMonth = addMonths(getCurrentMonth(), 2);

  // ---------------------------------------------------------------------------
  // Fetch Events (cached per month)
  // ---------------------------------------------------------------------------

  const {
    data: eventsData,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh,
  } = useCachedData<CalendarEvent[]>({
    cacheKey: `tbc_calendar_events_${currentMonth}`,
    fetcher: async () => {
      const response = await calendarApi.getEvents({
        month: currentMonth,
        limit: 50,
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load events');
      }
      return response.data.events || [];
    },
  });

  const events = eventsData || [];
  const error = fetchError?.message || null;

  // Get events for selected date (month view)
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(event => {
      const startDate = event.start;
      const endDate = event.end;
      return selectedDate >= startDate && selectedDate <= endDate;
    });
  }, [events, selectedDate]);

  // Reset selected date when month changes
  useEffect(() => {
    setSelectedDate(null);
  }, [currentMonth]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    refresh();
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
      onScroll={handleScroll}
      scrollEventThrottle={16}
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
      <View style={{ height: bottomPadding }} />
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
      onScroll={handleScroll}
      ListHeaderComponent={renderHeader()}
      emptyMessage={`No events in ${new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long' })}`}
    />
  );

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <TabActivityWrapper>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {viewMode === 'month' ? renderMonthView() : renderListView()}
      </View>
    </TabActivityWrapper>
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
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },

  noEventsText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

});
