// =============================================================================
// FEATURED EVENTS - Compact horizontal scroll (Instagram stories style)
// =============================================================================
// Modern mobile design: Small circular/compact cards that don't dominate screen
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
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { CalendarEvent } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FeaturedEventsProps {
  events: CalendarEvent[];
  onEventPress?: (event: CalendarEvent) => void;
  loading?: boolean;
}

// -----------------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------------

function formatShortDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate();
  return `${month} ${day}`;
}

// -----------------------------------------------------------------------------
// Featured Item Component (Stories style)
// -----------------------------------------------------------------------------

interface FeaturedItemProps {
  event: CalendarEvent;
  onPress?: () => void;
}

function FeaturedItem({ event, onPress }: FeaturedItemProps) {
  const borderColor = event.calendar_color || colors.primary;
  
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.8}>
      {/* Colored ring around image */}
      <View style={[styles.imageRing, { borderColor }]}>
        {event.image ? (
          <Image source={{ uri: event.image }} style={styles.itemImage} />
        ) : (
          <LinearGradient
            colors={[borderColor, borderColor + '80']}
            style={styles.itemImage}
          >
            <Text style={styles.placeholderEmoji}>📅</Text>
          </LinearGradient>
        )}
      </View>
      
      {/* Event title (truncated) */}
      <Text style={styles.itemTitle} numberOfLines={1}>
        {event.title.replace(/\s*[\u{1F300}-\u{1F9FF}]/gu, '')}
      </Text>
      
      {/* Date */}
      <Text style={styles.itemDate}>{formatShortDate(event.start)}</Text>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function FeaturedEvents({ events, onEventPress, loading }: FeaturedEventsProps) {
  if (loading || !events || events.length === 0) {
    return null; // Don't show section if empty or loading
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Featured</Text>
        <View style={styles.headerLine} />
      </View>
      
      <FlatList
        data={events}
        keyExtractor={(item) => `featured-${item.product_id}-${item.start}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <FeaturedItem
            event={item}
            onPress={() => onEventPress?.(item)}
          />
        )}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const ITEM_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.sm,
  },

  listContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  item: {
    alignItems: 'center',
    width: ITEM_SIZE,
  },

  imageRing: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    borderWidth: 2.5,
    padding: 2,
    marginBottom: spacing.xs,
  },

  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: (ITEM_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderEmoji: {
    fontSize: 24,
  },

  itemTitle: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    width: ITEM_SIZE + 8,
  },

  itemDate: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default FeaturedEvents;
