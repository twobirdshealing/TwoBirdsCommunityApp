// =============================================================================
// EVENT CARD - Modern full-width event card
// =============================================================================
// Features:
// - Full-width hero image with status badge
// - Haptic feedback on press
// - Deposit display when applicable
// - "Waitlist" status (not "Full")
// =============================================================================

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { CalendarEvent } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EventCardProps {
  event: CalendarEvent;
  onPress?: () => void;
  compact?: boolean;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatTime(time: string | null): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatEventDate(start: string, end: string, startTime: string | null): string {
  const startDate = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');
  
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  
  const timeStr = startTime ? formatTime(startTime) : '';
  const isMultiDay = start !== end;
  
  if (isMultiDay) {
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr} - ${endStr}`;
  }
  
  return timeStr ? `${dateStr} • ${timeStr}` : dateStr;
}

function getStatusConfig(event: CalendarEvent, themeColors: { success: string; successLight: string; warning: string; warningLight: string; error: string; errorLight: string; info: string; infoLight: string }) {
  if (event.user?.is_booked) {
    return { label: 'Registered', color: themeColors.success, bg: themeColors.successLight };
  }
  if (event.user?.is_on_waitlist) {
    return { label: 'On Waitlist', color: themeColors.warning, bg: themeColors.warningLight };
  }
  if (event.status === 'closed') {
    return { label: 'Waitlist', color: themeColors.error, bg: themeColors.errorLight };
  }
  return { label: 'Available', color: themeColors.info, bg: themeColors.infoLight };
}

function formatPrice(priceRaw: number, deposit: number | null): string {
  if (priceRaw === 0) {
    return '💝 Love Donation';
  }
  
  const price = `$${priceRaw}`;
  
  if (deposit && deposit > 0) {
    return `${price} • $${deposit} deposit`;
  }
  
  return price;
}

// -----------------------------------------------------------------------------
// Animated Pressable Card
// -----------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EventCard({ event, onPress, compact = false }: EventCardProps) {
  const { colors: themeColors } = useTheme();
  const status = getStatusConfig(event, themeColors);
  const eventDate = formatEventDate(event.start, event.end, event.start_time);
  const calendarColor = event.calendar_color || themeColors.primary;
  const location = event.location?.business_name || event.location?.address;
  
  // Animation for press feedback
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  // Compact card for month view
  if (compact) {
    return (
      <Pressable
        style={[styles.compactCard, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.colorBar, { backgroundColor: calendarColor }]} />

        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Text style={[styles.compactTitle, { color: themeColors.text }]} numberOfLines={1}>{event.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          
          <Text style={[styles.compactMeta, { color: themeColors.textSecondary }]}>{eventDate}</Text>

          {location && (
            <Text style={[styles.compactLocation, { color: themeColors.textTertiary }]} numberOfLines={1}>
              📍 {location}
            </Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
      </Pressable>
    );
  }

  // Full card for list view
  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: themeColors.surface }, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Hero Image */}
      <View style={styles.imageContainer}>
        {event.image ? (
          <Image source={{ uri: event.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[calendarColor, calendarColor + '80']}
            style={styles.image}
          >
            <Text style={styles.placeholderEmoji}>📅</Text>
          </LinearGradient>
        )}
        
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusBadgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
        
        {/* Color accent line */}
        <View style={[styles.colorAccent, { backgroundColor: calendarColor }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>{event.title}</Text>

        {/* Meta info */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={themeColors.textSecondary} />
          <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{eventDate}</Text>
        </View>

        {location && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>{location}</Text>
          </View>
        )}

        {/* Price + RSVP */}
        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          <Text style={[styles.price, { color: themeColors.text }]}>
            {formatPrice(event.price_raw, event.deposit ?? null)}
          </Text>
          
          {event.rsvp?.show_countdown && !event.rsvp.deadline_passed && (
            <View style={[styles.rsvpBadge, { backgroundColor: themeColors.warningLight }]}>
              <Text style={[styles.rsvpText, { color: themeColors.warning }]}>
                RSVP {event.rsvp.days_remaining}d left
              </Text>
            </View>
          )}
        </View>
        
        {/* Progress bar */}
        {event.progress && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: themeColors.backgroundSecondary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(event.progress.percentage, 100)}%`,
                    backgroundColor: calendarColor
                  }
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: themeColors.textTertiary }]}>
              {event.progress.current}/{event.progress.goal} spots filled
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Full Card
  card: {
    borderRadius: sizing.borderRadius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  imageContainer: {
    position: 'relative',
    height: 150,
  },

  image: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderEmoji: {
    fontSize: 48,
  },

  statusBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },

  statusBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: '700',
  },

  colorAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },

  content: {
    padding: spacing.md,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  metaText: {
    flex: 1,
    fontSize: typography.size.sm,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },

  price: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  rsvpBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },

  rsvpText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: '#D97706',
  },

  progressContainer: {
    marginTop: spacing.sm,
  },

  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  progressText: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  // Compact Card
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    borderBottomWidth: 1,
  },

  colorBar: {
    width: 4,
    height: '100%',
    minHeight: 50,
    borderRadius: 2,
    marginRight: spacing.sm,
  },

  compactContent: {
    flex: 1,
  },

  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },

  compactTitle: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  compactMeta: {
    fontSize: typography.size.sm,
  },

  compactLocation: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },
});

export default EventCard;
