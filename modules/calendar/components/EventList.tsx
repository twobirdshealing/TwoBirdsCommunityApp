// =============================================================================
// EVENT LIST - Scrollable list of event cards
// =============================================================================
// Uses FlashList for performance with modern EventCard design
// =============================================================================

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';
import { CalendarEvent } from '@/modules/calendar/types/calendar';
import { FlashList } from '@shopify/flash-list';
import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, StyleSheet, View } from 'react-native';
import { EventCard } from './EventCard';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EventListProps {
  events: CalendarEvent[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEventPress?: (event: CalendarEvent) => void;
  ListHeaderComponent?: React.ReactElement;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  emptyMessage?: string;
  compact?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EventList({
  events,
  loading = false,
  refreshing = false,
  error = null,
  onRefresh,
  onEventPress,
  onScroll,
  ListHeaderComponent,
  emptyMessage = 'No events scheduled',
  compact = false,
}: EventListProps) {
  const { colors: themeColors } = useTheme();
  const bottomPadding = useTabContentPadding();

  // Initial loading state
  if (loading && events.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {ListHeaderComponent}
        <LoadingSpinner message="Loading events..." />
      </View>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {ListHeaderComponent}
        <ErrorMessage message={error} onRetry={onRefresh} />
      </View>
    );
  }

  // Empty state
  if (!loading && events.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {ListHeaderComponent}
        <EmptyState icon="calendar-outline" message={emptyMessage} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <FlashList
        data={events}
        keyExtractor={(item) => `${item.product_id}-${item.start}`}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => onEventPress?.(item)}
            compact={compact}
          />
        )}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          ) : undefined
        }
      />
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

  listContent: {},
});

export default EventList;