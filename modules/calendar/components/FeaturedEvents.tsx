// =============================================================================
// FEATURED EVENTS - Instagram-stories style row of upcoming featured events
// =============================================================================
// - Date ABOVE the circle (more visible/prominent)
// - Uses tags[0] as short title (URL decoded)
// - 3 items centered evenly across screen
// =============================================================================
// Note: previously had a Reanimated shimmer ring that cycled across items
// every 4 seconds. Removed — same Animated.View + useEffect mount pattern
// as the lesson-completion crash, and decorative-only. Static event circles
// are clear enough on their own.
// =============================================================================

import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { CalendarEvent } from '@/modules/calendar/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FeaturedEventsProps {
  events: CalendarEvent[];
  onEventPress?: (event: CalendarEvent) => void;
  loading?: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = spacing.md * 2;
const AVAILABLE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING;
const NUM_ITEMS = 3;
const GAP = spacing.md;
const TOTAL_GAPS = (NUM_ITEMS - 1) * GAP;
const ITEM_WIDTH = Math.floor((AVAILABLE_WIDTH - TOTAL_GAPS) / NUM_ITEMS);
const IMAGE_SIZE = Math.min(ITEM_WIDTH - 10, 90);

const TITLE_LINE_HEIGHT = 18;
const TITLE_HEIGHT = 40;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatShortDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate();
  return `${month} ${day}`;
}

function getShortTitle(event: CalendarEvent): string {
  const tag = event.tags?.[0];

  if (tag) {
    try {
      const decoded = decodeURIComponent(tag);
      return decoded
        .split('-')
        .map(word => {
          if (/^[\u{1F300}-\u{1F9FF}]+$/u.test(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    } catch {
      // Fall through
    }
  }

  return event.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
}

// -----------------------------------------------------------------------------
// Featured Item
// -----------------------------------------------------------------------------

interface FeaturedItemProps {
  event: CalendarEvent;
  onPress?: () => void;
}

function FeaturedItem({ event, onPress }: FeaturedItemProps) {
  const { colors: themeColors } = useTheme();
  const borderColor = event.calendar_color || themeColors.primary;
  const shortTitle = getShortTitle(event);

  return (
    <AnimatedPressable style={styles.item} onPress={onPress}>
      {/* Date - on top */}
      <Text style={[styles.itemDate, { color: themeColors.primary }]}>{formatShortDate(event.start)}</Text>

      {/* Image ring */}
      <View style={[styles.imageRing, { borderColor, backgroundColor: themeColors.surface }]}>
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

      {/* Title below image */}
      <View style={styles.titleContainer}>
        <Text style={[styles.itemTitle, { color: themeColors.text }]} numberOfLines={2}>
          {shortTitle}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function FeaturedEvents({ events, onEventPress, loading }: FeaturedEventsProps) {
  const { colors: themeColors } = useTheme();

  if (loading || !events || events.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      <View style={styles.listContainer}>
        {events.slice(0, NUM_ITEMS).map((item) => (
          <FeaturedItem
            key={`featured-${item.product_id}-${item.start}`}
            event={item}
            onPress={() => onEventPress?.(item)}
          />
        ))}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },

  listContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },

  item: {
    alignItems: 'center',
    width: ITEM_WIDTH,
  },

  itemDate: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },

  imageRing: {
    width: IMAGE_SIZE + 8,
    height: IMAGE_SIZE + 8,
    borderRadius: (IMAGE_SIZE + 8) / 2,
    borderWidth: 3,
    padding: 3,
    marginBottom: spacing.xs,
  },

  itemImage: {
    width: IMAGE_SIZE - 4,
    height: IMAGE_SIZE - 4,
    borderRadius: (IMAGE_SIZE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderEmoji: {
    fontSize: typography.size.xxl,
  },

  titleContainer: {
    height: TITLE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: ITEM_WIDTH - 4,
  },

  itemTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    lineHeight: TITLE_LINE_HEIGHT,
  },
});

export default FeaturedEvents;
