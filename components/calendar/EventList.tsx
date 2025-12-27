// =============================================================================
// EVENT LIST - Scrollable list of event cards
// =============================================================================
// Uses FlashList for performance with modern EventCard design
// =============================================================================

import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { colors } from '@/constants/colors';
import { CalendarEvent } from '@/types/calendar';
import { EventCard } from './EventCard';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/components/common';

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
  ListHeaderComponent,
  emptyMessage = 'No events scheduled',
  compact = false,
}: EventListProps) {
  // Initial loading state
  if (loading && events.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeaderComponent}
        <LoadingSpinner message="Loading events..." />
      </View>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeaderComponent}
        <ErrorMessage message={error} onRetry={onRefresh} />
      </View>
    );
  }

  // Empty state
  if (!loading && events.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeaderComponent}
        <EmptyState icon="📅" message={emptyMessage} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        estimatedItemSize={compact ? 80 : 260}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
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
    backgroundColor: colors.background,
  },

  listContent: {
    paddingBottom: 100,
  },
});

export default EventList;
