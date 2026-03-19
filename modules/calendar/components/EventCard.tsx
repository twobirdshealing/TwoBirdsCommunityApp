// =============================================================================
// EVENT CARD - Hero-style event card with gradient overlay
// =============================================================================
// Features:
// - Hero image with gradient overlay (matches BlogCard/CourseCard pattern)
// - Prominent date chip as primary visual element
// - Haptic feedback on press
// - Deposit display when applicable
// - "Waitlist" status (not "Full")
// =============================================================================

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CalendarEvent } from '@/modules/calendar/types/calendar';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

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

function formatTime(time: string | null, is24Hour: boolean): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  if (is24Hour) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatEventDate(start: string, end: string, startTime: string | null, is24Hour: boolean): string {
  const startDate = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');

  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const timeStr = startTime ? formatTime(startTime, is24Hour) : '';
  const isMultiDay = start !== end;

  if (isMultiDay) {
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr} - ${endStr}`;
  }

  return timeStr ? `${dateStr} • ${timeStr}` : dateStr;
}

function formatDateChip(start: string, end: string, startTime: string | null, is24Hour: boolean): { month: string; day: string; timeLabel: string } {
  const startDate = new Date(start + 'T12:00:00');
  const month = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(startDate.getDate());
  const isMultiDay = start !== end;

  let timeLabel: string;
  if (isMultiDay) {
    const endDate = new Date(end + 'T12:00:00');
    timeLabel = `– ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else if (startTime) {
    timeLabel = formatTime(startTime, is24Hour);
  } else {
    timeLabel = 'All Day';
  }

  return { month, day, timeLabel };
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
    return 'Love Donation';
  }

  const price = `$${priceRaw}`;

  if (deposit && deposit > 0) {
    return `${price} • $${deposit} deposit`;
  }

  return price;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const EventCard = React.memo(function EventCard({ event, onPress, compact = false }: EventCardProps) {
  const { colors: themeColors } = useTheme();
  const { is24Hour } = useAppConfig();
  const status = getStatusConfig(event, themeColors);
  const eventDate = formatEventDate(event.start, event.end, event.start_time, is24Hour);
  const dateInfo = formatDateChip(event.start, event.end, event.start_time, is24Hour);
  const calendarColor = event.calendar_color || themeColors.primary;
  const location = event.location?.business_name || event.location?.address;
  const isFree = event.price_raw === 0;

  // Compact card for month view
  if (compact) {
    return (
      <AnimatedPressable
        style={[styles.compactCard, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
        onPress={onPress}
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
      </AnimatedPressable>
    );
  }

  // Full card for list view — hero style with gradient overlay
  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={onPress}
    >
      {/* Hero Section */}
      <View style={styles.heroContainer}>
        {/* Background: Image or Gradient Fallback */}
        {event.image ? (
          <Image
            source={{ uri: event.image }}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColors.border }]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient
            colors={[calendarColor, calendarColor + '80']}
            style={[StyleSheet.absoluteFillObject, styles.placeholderFallback]}
          >
            <Text style={styles.placeholderEmoji}>📅</Text>
          </LinearGradient>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.4, 1]}
          style={styles.heroGradient}
        >
          {/* Top Row: Date Chip + Status Badge */}
          <View style={styles.heroTopRow}>
            <View style={[styles.dateChip, { borderLeftColor: calendarColor }]}>
              <Text style={styles.dateChipMonth}>{dateInfo.month}</Text>
              <Text style={styles.dateChipDay}>{dateInfo.day}</Text>
              <Text style={styles.dateChipTime}>{dateInfo.timeLabel}</Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusBadgeText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          {/* Bottom: Title + Info */}
          <View>
            <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>

            <View style={styles.heroInfoRow}>
              {location ? (
                <View style={styles.heroLocation}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroLocationText} numberOfLines={1}>{location}</Text>
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              <View style={styles.heroPriceRow}>
                {isFree && (
                  <Ionicons name="heart-outline" size={13} color="#fff" />
                )}
                <Text style={styles.heroPrice}>
                  {formatPrice(event.price_raw, event.deposit ?? null)}
                </Text>
              </View>
            </View>

            {event.rsvp?.show_countdown && !event.rsvp.deadline_passed && (
              <View style={styles.heroRsvpPill}>
                <Text style={styles.heroRsvpText}>
                  RSVP {event.rsvp.days_remaining}d left
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* Progress Bar (only if data exists) */}
      {event.progress && (
        <View style={styles.progressSection}>
          <View style={[styles.progressBar, { backgroundColor: themeColors.backgroundSecondary }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(event.progress.percentage, 100)}%`,
                  backgroundColor: calendarColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: themeColors.textTertiary }]}>
            {event.progress.current}/{event.progress.goal} spots filled
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
});

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
    ...shadows.md,
  },

  // Hero Section
  heroContainer: {
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
  },

  placeholderFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderEmoji: {
    fontSize: sizing.icon.xxl,
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },

  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  dateChip: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: sizing.borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderLeftWidth: 3,
  },

  dateChipMonth: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#fff',
    opacity: 0.8,
  },

  dateChipDay: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: '#fff',
    lineHeight: 28,
  },

  dateChipTime: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: '#fff',
    opacity: 0.9,
  },

  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },

  statusBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  heroTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#fff',
    marginBottom: spacing.sm,
  },

  heroInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    marginRight: spacing.sm,
  },

  heroLocationText: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },

  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },

  heroPrice: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },

  heroRsvpPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: sizing.borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },

  heroRsvpText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },

  // Progress Section (below hero)
  progressSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  progressBar: {
    height: 4,
    borderRadius: sizing.borderRadius.full,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: sizing.borderRadius.full,
  },

  progressText: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  // Compact Card (month view — unchanged)
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
    borderRadius: sizing.borderRadius.full,
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
    fontWeight: typography.weight.semibold,
  },

  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.sm,
  },

  statusText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
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
