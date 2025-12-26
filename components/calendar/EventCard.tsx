// =============================================================================
// EVENT CARD - Main event display card for calendar list view
// =============================================================================
// Displays event with:
// - Status sidebar (AVAILABLE/WAITLIST/BOOKED)
// - Date badge + event image
// - Title, time, location, price
// - Tap to view event details (will open WebView later)
// =============================================================================

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { CalendarEvent } from '@/types/calendar';
import { DateBadge } from './DateBadge';
import { StatusBadge } from './StatusBadge';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EventCardProps {
  event: CalendarEvent;
  onPress?: () => void;
  onWaitlistToggle?: () => void;
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

function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime) return '';
  
  const start = formatTime(startTime);
  const end = endTime ? formatTime(endTime) : '';
  
  return end ? `${start} - ${end}` : start;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatPrice(priceRaw: number): string {
  if (priceRaw === 0) return 'Love Donations';
  return `$${priceRaw.toFixed(2)}`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EventCard({ event, onPress, onWaitlistToggle }: EventCardProps) {
  const timeRange = formatTimeRange(event.start_time, event.end_time);
  const dateFormatted = formatDate(event.start);
  const isMultiDay = event.start !== event.end;

  // Build location string
  const locationParts = [
    event.location?.business_name,
    event.location?.address,
  ].filter(Boolean);
  const locationString = locationParts.join(': ');

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Status Sidebar */}
      <StatusBadge status={event.status} userStatus={event.user} />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Date Badge + Image Row */}
        <View style={styles.mediaRow}>
          <DateBadge date={event.start} size="md" />
          
          {event.image ? (
            <Image
              source={{ uri: event.image }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="calendar" size={32} color={colors.textTertiary} />
            </View>
          )}
        </View>

        {/* Event Details */}
        <View style={styles.details}>
          {/* Date & Time */}
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {dateFormatted}
              {timeRange ? ` @ ${timeRange}` : ''}
              {isMultiDay ? ` - ${formatDate(event.end)}` : ''}
            </Text>
          </View>

          {/* Location */}
          {locationString ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {locationString}
              </Text>
            </View>
          ) : null}

          {/* Price */}
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {formatPrice(event.price_raw)}
            </Text>
          </View>

          {/* RSVP Deadline */}
          {event.rsvp?.show_countdown && !event.rsvp.deadline_passed ? (
            <View style={styles.rsvpBadge}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={styles.rsvpText}>
                RSVP by {event.rsvp.formatted_deadline} ({event.rsvp.days_remaining} days)
              </Text>
            </View>
          ) : null}
        </View>

        {/* User Status Badge (if booked or on waitlist) */}
        {event.user?.is_booked ? (
          <View style={styles.userStatusBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.userStatusText}>You're Registered</Text>
            {event.user.booked_quantity && event.user.booked_quantity > 1 ? (
              <Text style={styles.quantityText}>
                ({event.user.booked_quantity} spots)
              </Text>
            ) : null}
          </View>
        ) : event.user?.is_on_waitlist ? (
          <View style={[styles.userStatusBadge, styles.waitlistBadge]}>
            <Ionicons name="time" size={16} color={colors.warning} />
            <Text style={[styles.userStatusText, styles.waitlistText]}>On Waitlist</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  content: {
    flex: 1,
    padding: spacing.md,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  image: {
    width: 100,
    height: 80,
    borderRadius: sizing.borderRadius.sm,
  },

  imagePlaceholder: {
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  details: {
    gap: spacing.xs,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  detailText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  rsvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
    alignSelf: 'flex-start',
  },

  rsvpText: {
    fontSize: typography.size.xs,
    color: colors.warning,
    fontWeight: '600',
  },

  userStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
    alignSelf: 'flex-start',
  },

  waitlistBadge: {
    backgroundColor: colors.warningLight,
  },

  userStatusText: {
    fontSize: typography.size.sm,
    color: colors.success,
    fontWeight: '600',
  },

  waitlistText: {
    color: colors.warning,
  },

  quantityText: {
    fontSize: typography.size.xs,
    color: colors.success,
  },
});

export default EventCard;
