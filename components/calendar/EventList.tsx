// =============================================================================
// EVENT LIST - Scrollable list of event cards
// =============================================================================
// Renders a FlashList of EventCard components with:
// - Pull to refresh
// - Loading states
// - Empty state
// - Error handling
// =============================================================================

import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
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
  onWaitlistToggle?: (event: CalendarEvent) => void;
  ListHeaderComponent?: React.ReactElement;
  emptyMessage?: string;
  emptyIcon?: string;
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
  onWaitlistToggle,
  ListHeaderComponent,
  emptyMessage = 'No events scheduled',
  emptyIcon = '📅',
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
        <EmptyState icon={emptyIcon} message={emptyMessage} />
      </View>
    );
  }

  // Render event item
  const renderItem = ({ item }: { item: CalendarEvent }) => (
    <EventCard
      event={item}
      onPress={() => onEventPress?.(item)}
      onWaitlistToggle={() => onWaitlistToggle?.(item)}
    />
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={events}
        keyExtractor={(item) => `${item.product_id}-${item.start}`}
        renderItem={renderItem}
        estimatedItemSize={200}
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
    paddingBottom: 100, // Space for tab bar
  },
});

export default EventList;
