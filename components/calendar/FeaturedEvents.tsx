// =============================================================================
// FEATURED EVENTS - Instagram stories style with short titles from tags
// =============================================================================
// - Date ABOVE the circle (more visible/prominent)
// - Uses tags[0] as short title (URL decoded)
// - 3 items centered evenly across screen
// - Subtle shimmer animation
// =============================================================================

import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
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
  index: number;
  activeIndex: number;
  onPress?: () => void;
}

function FeaturedItem({ event, index, activeIndex, onPress }: FeaturedItemProps) {
  const borderColor = event.calendar_color || colors.primary;
  const isActive = index === activeIndex;
  const shortTitle = getShortTitle(event);
  
  const shimmerOpacity = useSharedValue(0);
  const shimmerRotation = useSharedValue(0);
  
  useEffect(() => {
    if (isActive) {
      shimmerOpacity.value = withSequence(
        withTiming(0.4, { duration: 400 }),
        withTiming(0, { duration: 1000 })
      );
      shimmerRotation.value = withTiming(360, { 
        duration: 1400,
        easing: Easing.out(Easing.cubic) 
      });
    } else {
      shimmerOpacity.value = 0;
      shimmerRotation.value = 0;
    }
  }, [isActive]);
  
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
    transform: [{ rotate: `${shimmerRotation.value}deg` }],
  }));
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };
  
  return (
    <TouchableOpacity style={styles.item} onPress={handlePress} activeOpacity={0.8}>
      {/* Date - NOW ON TOP */}
      <Text style={styles.itemDate}>{formatShortDate(event.start)}</Text>
      
      {/* Image container with ring */}
      <View style={styles.imageContainer}>
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
        
        {/* Shimmer overlay */}
        <Animated.View style={[styles.shimmerRing, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.8)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>
      </View>
      
      {/* Title below image */}
      <View style={styles.titleContainer}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {shortTitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function FeaturedEvents({ events, onEventPress, loading }: FeaturedEventsProps) {
  const [activeIndexState, setActiveIndexState] = React.useState(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!events || events.length === 0) return;
    
    const cycleShimmer = () => {
      setActiveIndexState(prev => {
        let next = Math.floor(Math.random() * events.length);
        while (next === prev && events.length > 1) {
          next = Math.floor(Math.random() * events.length);
        }
        return next;
      });
    };
    
    const initialTimeout = setTimeout(cycleShimmer, 2000);
    intervalRef.current = setInterval(cycleShimmer, 4000);
    
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [events?.length]);

  if (loading || !events || events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>FEATURED</Text>
        <View style={styles.headerLine} />
      </View>
      
      <View style={styles.listContainer}>
        {events.slice(0, 4).map((item, index) => (
          <FeaturedItem
            key={`featured-${item.product_id}-${item.start}`}
            event={item}
            index={index}
            activeIndex={activeIndexState}
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
    letterSpacing: 0.5,
  },

  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.sm,
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

  // Date on top - more prominent
  itemDate: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },

  imageContainer: {
    position: 'relative',
    width: IMAGE_SIZE + 8,
    height: IMAGE_SIZE + 8,
    marginBottom: spacing.xs,
  },

  imageRing: {
    width: IMAGE_SIZE + 8,
    height: IMAGE_SIZE + 8,
    borderRadius: (IMAGE_SIZE + 8) / 2,
    borderWidth: 3,
    padding: 3,
    backgroundColor: colors.surface,
  },

  itemImage: {
    width: IMAGE_SIZE - 4,
    height: IMAGE_SIZE - 4,
    borderRadius: (IMAGE_SIZE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shimmerRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: IMAGE_SIZE + 14,
    height: IMAGE_SIZE + 14,
    borderRadius: (IMAGE_SIZE + 14) / 2,
    overflow: 'hidden',
  },

  shimmerGradient: {
    width: '100%',
    height: '100%',
  },

  placeholderEmoji: {
    fontSize: 32,
  },

  titleContainer: {
    height: TITLE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: ITEM_WIDTH - 4,
  },

  itemTitle: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: TITLE_LINE_HEIGHT,
  },
});

export default FeaturedEvents;
