// =============================================================================
// EVENT CARD - Modern full-width event card
// =============================================================================
// Instagram-style design:
// - Full-width hero image
// - Compact info layout
// - Small status pill badge
// - Clean typography
// =============================================================================

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { CalendarEvent } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EventCardProps {
  event: CalendarEvent;
  onPress?: () => void;
  compact?: boolean;  // For month view selected day
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

function getStatusConfig(event: CalendarEvent) {
  if (event.user?.is_booked) {
    return { label: 'Registered', color: colors.success, bg: colors.successLight };
  }
  if (event.user?.is_on_waitlist) {
    return { label: 'Waitlist', color: colors.warning, bg: colors.warningLight };
  }
  if (event.status === 'closed') {
    return { label: 'Full', color: colors.error, bg: colors.errorLight };
  }
  return { label: 'Available', color: colors.info, bg: colors.infoLight };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EventCard({ event, onPress, compact = false }: EventCardProps) {
  const status = getStatusConfig(event);
  const eventDate = formatEventDate(event.start, event.end, event.start_time);
  const calendarColor = event.calendar_color || colors.primary;

  // Build location string
  const location = event.location?.business_name || event.location?.address;

  if (compact) {
    // Compact card for month view
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onPress} activeOpacity={0.7}>
        {/* Color indicator */}
        <View style={[styles.colorBar, { backgroundColor: calendarColor }]} />
        
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactTitle} numberOfLines={1}>{event.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          
          <Text style={styles.compactMeta}>{eventDate}</Text>
          
          {location && (
            <Text style={styles.compactLocation} numberOfLines={1}>
              📍 {location}
            </Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  // Full card for list view
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
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
        
        {/* Status Badge (overlay) */}
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
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        
        {/* Meta info */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{eventDate}</Text>
        </View>
        
        {location && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{location}</Text>
          </View>
        )}
        
        {/* Price */}
        <View style={styles.footer}>
          <Text style={styles.price}>
            {event.price_raw === 0 ? '💝 Love Donation' : `$${event.price_raw}`}
          </Text>
          
          {/* RSVP countdown */}
          {event.rsvp?.show_countdown && !event.rsvp.deadline_passed && (
            <View style={styles.rsvpBadge}>
              <Text style={styles.rsvpText}>
                RSVP {event.rsvp.days_remaining}d left
              </Text>
            </View>
          )}
        </View>
        
        {/* Progress bar if applicable */}
        {event.progress && event.progress.show_percentage && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${event.progress.percentage}%`, backgroundColor: calendarColor }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {event.progress.current}/{event.progress.goal} spots filled
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Full Card
  card: {
    backgroundColor: colors.surface,
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
    height: 140,
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
    height: 3,
  },

  content: {
    padding: spacing.md,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.text,
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
    color: colors.textSecondary,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  price: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
  },

  rsvpBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },

  rsvpText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: colors.warning,
  },

  progressContainer: {
    marginTop: spacing.sm,
  },

  progressBar: {
    height: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  progressText: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Compact Card (for month view)
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
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
    color: colors.textSecondary,
  },

  compactLocation: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});

export default EventCard;
