// =============================================================================
// CEREMONY WIDGET - Upcoming booked event with countdown
// =============================================================================
// Shows the user's next booked event (ceremony, sound journey, kambo, etc.)
// with a live countdown. Returns null if no upcoming bookings, so the
// HomeWidget wrapper auto-hides. Data is pre-populated by the startup batch.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { spacing, sizing, shadows, typography } from '@/constants/layout';
import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { useEventWebView } from '@/modules/calendar/hooks/useEventWebView';
import calendarApi from '@/modules/calendar/services/calendarApi';
import type { CalendarEvent } from '@/modules/calendar/types/calendar';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface CeremonyWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Countdown helpers
// -----------------------------------------------------------------------------

function getEventDateTime(event: CalendarEvent): Date {
  const dateStr = event.start;
  if (event.start_time) {
    return new Date(`${dateStr}T${event.start_time}:00`);
  }
  // No time set — default to start of day
  return new Date(`${dateStr}T00:00:00`);
}

function formatCountdown(target: Date): string {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return 'Now';

  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0 && diffHours === 0) return `${diffMins}m`;
  if (diffDays === 0) return `${diffHours}h ${diffMins % 60}m`;
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays}d ${diffHours % 24}h`;
}

function formatEventDate(event: CalendarEvent, is24Hour: boolean): string {
  const date = new Date(`${event.start}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  };
  let formatted = date.toLocaleDateString('en-US', options);

  if (event.start_time) {
    const [h, m] = event.start_time.split(':').map(Number);
    if (is24Hour) {
      formatted += ` at ${h}:${String(m).padStart(2, '0')}`;
    } else {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      formatted += ` at ${hour12}:${String(m).padStart(2, '0')} ${period}`;
    }
  }

  return formatted;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CeremonyWidget({ refreshKey }: CeremonyWidgetProps) {
  const { colors: themeColors } = useTheme();
  const { is24Hour } = useAppConfig();
  const { openEvent } = useEventWebView();
  const [countdown, setCountdown] = useState('');

  const { data: event } = useAppQuery<CalendarEvent | null>({
    cacheKey: 'tbc_widget_ceremony',
    fetcher: async () => {
      const response = await calendarApi.getUserBooked(1);
      if (!response.success) return null;
      return response.data.events[0] ?? null;
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: WIDGET_STALE_TIME,
  });

  // Live countdown — update every 60s
  useEffect(() => {
    if (!event) return;

    const update = () => setCountdown(formatCountdown(getEventDateTime(event)));
    update();

    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [event]);

  // No upcoming bookings — hide widget entirely
  if (!event) return null;

  const location = event.location?.business_name;
  const ringColor = event.calendar_color || themeColors.primary;

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={() => openEvent(event)}
    >
      {/* Avatar column: image/icon + countdown */}
      <View style={styles.avatarColumn}>
        {event.image ? (
          <View style={[styles.imageRing, { borderColor: ringColor }]}>
            <Image
              source={{ uri: event.image }}
              style={styles.eventImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </View>
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
            <Ionicons name="calendar-outline" size={22} color={themeColors.primary} />
          </View>
        )}
        {countdown ? (
          <Text style={[styles.countdownText, { color: themeColors.primary }]}>
            {countdown}
          </Text>
        ) : null}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.date, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {formatEventDate(event, is24Hour)}
        </Text>
        {location ? (
          <Text style={[styles.location, { color: themeColors.textTertiary }]} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    ...shadows.sm,
  },

  avatarColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },

  imageRing: {
    width: sizing.avatar.md,
    height: sizing.avatar.md,
    borderRadius: sizing.avatar.md / 2,
    borderWidth: 2,
    padding: 2,
  },

  eventImage: {
    width: '100%',
    height: '100%',
    borderRadius: sizing.avatar.md / 2,
  },

  iconCircle: {
    width: sizing.avatar.md,
    height: sizing.avatar.md,
    borderRadius: sizing.avatar.md / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: {
    flex: 1,
    gap: 2,
  },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  date: {
    fontSize: typography.size.sm,
  },

  location: {
    fontSize: typography.size.xs,
  },

  countdownText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
});

export default CeremonyWidget;
