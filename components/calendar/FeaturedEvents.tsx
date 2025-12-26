// =============================================================================
// FEATURED EVENTS - Horizontal scrolling featured event cards
// =============================================================================
// Displays featured/highlighted events in a horizontal scroll
// Similar to web version's "Featured Events" section
// =============================================================================

import React from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { CalendarEvent } from '@/types/calendar';
import { DateBadge } from './DateBadge';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FeaturedEventsProps {
  events: CalendarEvent[];
  onEventPress?: (event: CalendarEvent) => void;
  loading?: boolean;
}

// -----------------------------------------------------------------------------
// Featured Card Component
// -----------------------------------------------------------------------------

interface FeaturedCardProps {
  event: CalendarEvent;
  onPress?: () => void;
}

function FeaturedCard({ event, onPress }: FeaturedCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Event Image */}
      {event.image ? (
        <Image
          source={{ uri: event.image }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="calendar" size={40} color={colors.textTertiary} />
        </View>
      )}

      {/* Event Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {event.title}
      </Text>

      {/* Date Badge */}
      <View style={styles.dateBadgeContainer}>
        <DateBadge date={event.start} size="sm" />
      </View>

      {/* Learn More */}
      <TouchableOpacity style={styles.learnMoreButton} onPress={onPress}>
        <Text style={styles.learnMoreText}>Learn More</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function FeaturedEvents({ events, onEventPress, loading }: FeaturedEventsProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Featured Events</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading featured events...</Text>
        </View>
      </View>
    );
  }

  if (!events || events.length === 0) {
    return null; // Don't show section if no featured events
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Featured Events</Text>
      
      <FlatList
        data={events}
        keyExtractor={(item) => `featured-${item.product_id}-${item.start}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={CARD_WIDTH + spacing.md}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <FeaturedCard
            event={item}
            onPress={() => onEventPress?.(item)}
          />
        )}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CARD_WIDTH = 160;

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },

  sectionTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  listContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  cardImage: {
    width: CARD_WIDTH - spacing.md * 2,
    height: 80,
    borderRadius: sizing.borderRadius.md,
    marginBottom: spacing.sm,
  },

  cardImagePlaceholder: {
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
    minHeight: 40, // Reserve space for 2 lines
  },

  dateBadgeContainer: {
    marginBottom: spacing.sm,
  },

  learnMoreButton: {
    paddingVertical: spacing.xs,
  },

  learnMoreText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});

export default FeaturedEvents;
